const fs = require('fs');
const file = 'chess engine 3.js';
let code = fs.readFileSync(file, 'utf8');

const startStr = "        _onPremoveMessage: function (data) {";
const endStr = "                if (!this._premoveProcessedFens.has(currentFenHash) && !premoveInFlight) {\n                    State.statusInfo = \"[Premove] Got bestmove but no execution yet, waiting for PV...\";\n                }\n            }\n        },";

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);
if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find start or end bounds.");
    process.exit(1);
}

const before = code.substring(0, startIdx);
const after = code.substring(endIdx + endStr.length);

const replacement = `        _onPremoveMessage: async function (data) {
            this._premoveLastActivityTs = Date.now();

            if (typeof data !== "string") return;
            if (State.analysisMode) return;

            const currentFen = getAccurateFen();
            if (!currentFen) return;

            const currentFenHash = hashFen(currentFen);

            if (this._premoveProcessedFens.has(currentFenHash)) {
                State.statusInfo = "[Premove] Already processed FEN: " + currentFenHash.substring(0, 30);
                return;
            }

            const game = getGame();
            if (game && isPlayersTurn(game)) {
                this._premoveProcessedFens.add(currentFenHash);
                return;
            }

            if (data.indexOf("info") === 0 && data.includes(" pv ")) {
                if (this._premoveProcessing) return;

                this._premoveProcessing = true;
                State.premoveAnalysisInProgress = true;

                try {
                    const tokens = data.split(" ");
                    const pvIdx = tokens.indexOf("pv");
                    const scoreIdx = tokens.indexOf("score");

                    if (pvIdx === -1) return;

                    const pvMoves = tokens.slice(pvIdx + 1).filter(m => /^[a-h][1-8][a-h][1-8]/i.test(m));
                    if (pvMoves.length === 0) return;

                    let scoreInfo = null;
                    if (scoreIdx !== -1) {
                        const type = tokens[scoreIdx + 1];
                        const value = parseInt(tokens[scoreIdx + 2]);
                        scoreInfo = {
                            type,
                            value,
                            display: type === 'mate' ? \`M\${value}\` : (value / 100).toFixed(2)
                        };
                        State._lastPremoveScoreInfo = scoreInfo;
                    }

                    const ourColor = getPlayingAs();
                    const stm = getCurrentTurn(currentFen);

                    if (!ourColor || stm === ourColor) return;

                    const ourUci = getOurMoveFromPV(pvMoves.join(" "), ourColor, stm);
                    if (!ourUci) return;

                    if (this._premoveProcessedFens.has(currentFenHash)) return;

                    const multiPvIdx = tokens.indexOf("multipv");
                    const multiPv = multiPvIdx !== -1 ? (parseInt(tokens[multiPvIdx + 1], 10) || 1) : 1;
                    const candidateBucket = this._premoveCandidates[currentFenHash] || [];

                    const existingCandidateIdx = candidateBucket.findIndex(c => c.multiPv === multiPv);
                    const candidatePayload = {
                        multiPv: multiPv,
                        ourUci: ourUci,
                        pvMoves: pvMoves.slice(0, 6),
                        scoreInfo: scoreInfo
                    };
                    if (existingCandidateIdx >= 0) candidateBucket[existingCandidateIdx] = candidatePayload;
                    else candidateBucket.push(candidatePayload);
                    this._premoveCandidates[currentFenHash] = candidateBucket;

                    let selectedMove = ourUci;
                    let selectedDecision = null;
                    let selectedCandidate = null;
                    const rankedCandidates = candidateBucket.slice().sort((a, b) => a.multiPv - b.multiPv).slice(0, 2);

                    for (let ci = 0; ci < rankedCandidates.length; ci++) {
                        const candidate = rankedCandidates[ci];
                        const decision = SmartPremove.shouldPremove(currentFen, candidate.ourUci, candidate.pvMoves, candidate.scoreInfo);
                        if (!selectedDecision || (decision.allowed && (!selectedDecision.allowed || (decision.confidence || 0) > (selectedDecision.confidence || 0)))) {
                            selectedDecision = decision;
                            selectedMove = candidate.ourUci;
                            selectedCandidate = candidate;
                        }
                    }

                    const decision = selectedDecision || SmartPremove.shouldPremove(currentFen, ourUci, pvMoves, scoreInfo);
                    const finalScoreInfo = selectedCandidate ? selectedCandidate.scoreInfo : scoreInfo;

                    let confidence = Math.round(decision.confidence || 0);
                    let requiredConfidence = Math.round((decision.required !== undefined && decision.required !== null) ? decision.required : ((SmartPremove.AGGRESSION_CONFIG[State.premoveMode] || SmartPremove.AGGRESSION_CONFIG.every).minConfidence || 0));
                    State.premoveLiveChance = clamp(confidence, 0, 100);
                    State.premoveTargetChance = clamp(requiredConfidence, 0, 100);
                    State.premoveLastEvalDisplay = finalScoreInfo ? String(finalScoreInfo.display || "-") : "-";
                    State.premoveLastMoveDisplay = selectedMove ? String(selectedMove).toUpperCase() : "-";
                    State.premoveChanceReason = decision.allowed ? "Ready" : (decision.reason || "Blocked");
                    State.premoveChanceUpdatedTs = Date.now();
                    UI.updatePremoveChanceDisplay();

                    const firstAttemptForFen = !this._premoveAttemptedFens.has(currentFenHash);
                    if (firstAttemptForFen) {
                        this._premoveAttemptedFens.add(currentFenHash);
                        State.premoveStats.attempted++;
                    }

                    if (decision.allowed) {
                        if (firstAttemptForFen) State.premoveStats.allowed++;
                        this._premoveProcessedFens.add(currentFenHash);

                        const MAX_ENGINE_CACHE = Math.min(10, CONFIG.PREMOVE.MAX_EXECUTED_FENS || 50);
                        if (this._premoveProcessedFens.size > MAX_ENGINE_CACHE) {
                            const toDelete = this._premoveProcessedFens.size - Math.floor(MAX_ENGINE_CACHE * 0.6);
                            for (let i = 0; i < toDelete; i++) {
                                const iter = this._premoveProcessedFens.values();
                                const first = iter.next().value;
                                if (first) this._premoveProcessedFens.delete(first);
                            }
                        }

                        let success = await SmartPremove.execute(currentFen, selectedMove, decision);
                        if (!success) {
                            this._premoveProcessedFens.delete(currentFenHash);
                            State.premoveStats.failed++;
                        } else {
                            State.premoveStats.executed++;
                        }
                        UI.updatePremoveStatsDisplay();
                    } else {
                        if (firstAttemptForFen) State.premoveStats.blocked++;
                        State.statusInfo = \`Premove: \${decision.reason}\`;
                        UI.updateStatusInfo();
                        UI.updatePremoveStatsDisplay();
                        this._premoveProcessedFens.add(currentFenHash);
                    }
                } catch (e) {
                    err("[Engine] _onPremoveMessage loop error:", e);
                } finally {
                    this._premoveProcessing = false;
                    State.premoveAnalysisInProgress = false;
                }
            }

            if (data.indexOf("bestmove") === 0) {
                this._premoveEngineBusy = false;
                if (this._premoveTimeoutId) {
                    clearTimeout(this._premoveTimeoutId);
                    this._premoveTimeoutId = null;
                }

                const tokens = data.split(" ");
                const bestMove = tokens[1];
                if (!bestMove || bestMove === "(none)") return;

                if (!this._premoveProcessedFens.has(currentFenHash) && !premoveInFlight) {
                    State.statusInfo = "[Premove] Got bestmove but no execution yet, waiting for PV...";
                }
            }
        },`;

fs.writeFileSync(file, before + replacement + after, 'utf8');
console.log("Successfully replaced _onPremoveMessage!");
