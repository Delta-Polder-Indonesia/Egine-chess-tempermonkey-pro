module.exports = [
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                window: "readonly",
                document: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                clearTimeout: "readonly",
                localStorage: "readonly",
                XMLHttpRequest: "readonly",
                Promise: "readonly",
                Math: "readonly",
                Date: "readonly",
                JSON: "readonly",
                atob: "readonly",
                btoa: "readonly",
                unsafeWindow: "readonly",
                GM_getValue: "readonly",
                GM_setValue: "readonly",
                GM_getResourceText: "readonly",
                GM_registerMenuCommand: "readonly",
                GM_info: "readonly",
                GM_xmlhttpRequest: "readonly",
                GM_addStyle: "readonly",
                Array: "readonly",
                Object: "readonly",
                String: "readonly",
                Number: "readonly",
                Boolean: "readonly",
                Error: "readonly",
                Event: "readonly",
                MutationObserver: "readonly",
                customElements: "readonly",
                HTMLElement: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", {
                "args": "none",
                "caughtErrors": "none",
                "ignoreRestSiblings": true,
                "varsIgnorePattern": "^(DEBUG|isTampermonkey|_inferErrorModule|reportErrorTelemetry)$"
            }]
        }
    }
];
