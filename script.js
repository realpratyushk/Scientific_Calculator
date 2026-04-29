/* ============================================
   SCIENTIFIC CALCULATOR - JAVASCRIPT ENGINE
   Pure Vanilla JS - No Dependencies
   ============================================ */

// ─────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────

/** Current expression string (user-facing display format) */
let expression = '';

/** Last evaluated result */
let lastResult = '0';

/** Whether we just pressed = and got a result */
let justEvaluated = false;

/** Sound enabled toggle */
let soundEnabled = false;

/** Dark mode toggle */
let darkMode = false;

/** AudioContext for click sounds (lazy init) */
let audioCtx = null;


// ─────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────

const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const displayEl = document.getElementById('display');
const soundToggle = document.getElementById('soundToggle');
const darkModeToggle = document.getElementById('darkModeToggle');
const calculatorEl = document.getElementById('calculator');
const modeIndicator = document.getElementById('modeIndicator');


// ─────────────────────────────────────────────
// MATHEMATICAL HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Calculate the factorial of a non-negative integer.
 * @param {number} n - Non-negative integer
 * @returns {number} n!
 */
function factorial(n) {
    n = Math.round(n); // Ensure integer
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity; // JS can't handle > 170!
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

/**
 * Sine in degrees
 */
function sinDeg(x) {
    return Math.sin(x * Math.PI / 180);
}

/**
 * Cosine in degrees
 */
function cosDeg(x) {
    return Math.cos(x * Math.PI / 180);
}

/**
 * Tangent in degrees
 */
function tanDeg(x) {
    return Math.tan(x * Math.PI / 180);
}


// ─────────────────────────────────────────────
// EXPRESSION EVALUATION
// ─────────────────────────────────────────────

/**
 * Convert the display expression into a computable JavaScript string,
 * then evaluate it safely.
 * @param {string} expr - The display expression
 * @returns {string|number} The result or 'Error'
 */
function evaluateExpression(expr) {
    try {
        let e = expr;

        // ── Step 1: Replace display symbols with JS operators ──
        e = e.replace(/×/g, '*');
        e = e.replace(/÷/g, '/');
        e = e.replace(/−/g, '-');

        // ── Step 2: Replace constants ──
        // π → Math.PI (use parentheses to avoid concatenation issues)
        e = e.replace(/π/g, '(Math.PI)');

        // ℯ → Math.E (careful not to match inside function names)
        e = e.replace(/ℯ/g, '(Math.E)');

        // ── Step 3: Replace scientific functions (DEG mode) ──
        e = e.replace(/sin\(/g, 'sinDeg(');
        e = e.replace(/cos\(/g, 'cosDeg(');
        e = e.replace(/tan\(/g, 'tanDeg(');
        e = e.replace(/log\(/g, 'Math.log10(');
        e = e.replace(/ln\(/g, 'Math.log(');
        e = e.replace(/sqrt\(/g, 'Math.sqrt(');

        // ── Step 4: Replace power operator ──
        e = e.replace(/\^/g, '**');

        // ── Step 5: Handle factorial ──
        // First handle simple number factorials: 5! → factorial(5)
        e = e.replace(/(\d+)!/g, 'factorial($1)');

        // Handle parenthesized expression factorials: (expr)! → factorial(expr)
        // Uses bracket matching to find the matching opening paren
        let safetyCounter = 0;
        while (e.includes(')!') && safetyCounter < 20) {
            safetyCounter++;
            const bangIndex = e.indexOf(')!');
            let parenDepth = 0;
            let openIndex = -1;

            for (let i = bangIndex; i >= 0; i--) {
                if (e[i] === ')') parenDepth++;
                if (e[i] === '(') {
                    parenDepth--;
                    if (parenDepth === 0) {
                        openIndex = i;
                        break;
                    }
                }
            }

            if (openIndex >= 0) {
                const before = e.substring(0, openIndex);
                const inside = e.substring(openIndex, bangIndex + 1);
                const after = e.substring(bangIndex + 2);
                e = before + 'factorial' + inside + after;
            } else {
                break;
            }
        }

        // ── Step 6: Handle percent ──
        e = e.replace(/(\d+\.?\d*)%/g, '($1/100)');

        // ── Step 7: Auto-close unclosed parentheses ──
        const openParens = (e.match(/\(/g) || []).length;
        const closeParens = (e.match(/\)/g) || []).length;
        if (openParens > closeParens) {
            e += ')'.repeat(openParens - closeParens);
        }

        // ── Step 8: Evaluate using Function constructor ──
        // This is safer than direct eval() and allows us to pass helpers
        const fn = new Function(
            'sinDeg', 'cosDeg', 'tanDeg', 'factorial', 'Math',
            'return (' + e + ')'
        );

        const result = fn(sinDeg, cosDeg, tanDeg, factorial, Math);

        // ── Step 9: Validate result ──
        if (result === undefined || result === null) {
            return 'Error';
        }
        if (typeof result === 'number' && isNaN(result)) {
            return 'Error';
        }
        if (result === Infinity) return '∞';
        if (result === -Infinity) return '-∞';

        return result;

    } catch (err) {
        return 'Error';
    }
}


// ─────────────────────────────────────────────
// DISPLAY FORMATTING
// ─────────────────────────────────────────────

/**
 * Format a number for display.
 * - Whole numbers: no decimals
 * - Decimals: up to 10 significant digits, trim trailing zeros
 * - Very large/small: scientific notation
 * @param {number|string} value
 * @returns {string}
 */
function formatResult(value) {
    if (typeof value === 'string') return value; // Error, ∞, etc.

    // Handle very large or very small numbers
    if (Math.abs(value) > 1e15 || (Math.abs(value) < 1e-10 && value !== 0)) {
        return value.toExponential(6);
    }

    // Round to avoid floating point artifacts
    let rounded = parseFloat(value.toPrecision(12));

    // Convert to string
    let str = rounded.toString();

    // If the string is too long, truncate
    if (str.length > 14) {
        str = parseFloat(value.toPrecision(10)).toString();
    }

    return str;
}


/**
 * Adjust font size based on content length.
 */
function adjustFontSizes() {
    // Expression line
    const exprLen = expressionEl.textContent.length;
    if (exprLen > 30) {
        expressionEl.style.fontSize = '12px';
    } else if (exprLen > 22) {
        expressionEl.style.fontSize = '13px';
    } else if (exprLen > 15) {
        expressionEl.style.fontSize = '14px';
    } else {
        expressionEl.style.fontSize = '';  // Reset to CSS default
    }

    // Result line
    const resLen = resultEl.textContent.length;
    if (resLen > 16) {
        resultEl.style.fontSize = '22px';
    } else if (resLen > 12) {
        resultEl.style.fontSize = '28px';
    } else if (resLen > 9) {
        resultEl.style.fontSize = '32px';
    } else {
        resultEl.style.fontSize = '';  // Reset to CSS default
    }
}


// ─────────────────────────────────────────────
// DISPLAY UPDATE
// ─────────────────────────────────────────────

/**
 * Update the display with current expression and try live preview.
 */
function updateDisplay() {
    expressionEl.textContent = expression;

    // Try a live preview of the result
    if (expression.length > 0) {
        const preview = evaluateExpression(expression);
        if (preview !== 'Error') {
            resultEl.textContent = formatResult(preview);
            resultEl.classList.remove('error');
            resultEl.classList.add('preview');
        }
        // If error in preview, keep showing last result
    } else {
        resultEl.textContent = lastResult;
        resultEl.classList.remove('error', 'preview');
    }

    adjustFontSizes();
}

/**
 * Show the final result (after pressing =).
 */
function showResult(value) {
    const formatted = formatResult(value);

    resultEl.textContent = formatted;
    resultEl.classList.remove('preview');

    if (formatted === 'Error') {
        resultEl.classList.add('error');
        resultEl.classList.remove('flash');
        // Shake animation
        displayEl.classList.remove('shake');
        void displayEl.offsetWidth; // Trigger reflow
        displayEl.classList.add('shake');
    } else {
        resultEl.classList.remove('error');
        // Flash animation
        resultEl.classList.remove('flash');
        void resultEl.offsetWidth;
        resultEl.classList.add('flash');
    }

    lastResult = formatted;
    adjustFontSizes();
}


// ─────────────────────────────────────────────
// INPUT HANDLING
// ─────────────────────────────────────────────

/**
 * Check if a character is an operator (+, −, ×, ÷).
 */
function isOperator(char) {
    return ['+', '−', '×', '÷'].includes(char);
}

/**
 * Check if the last character of the expression is an operator.
 */
function lastCharIsOperator() {
    if (expression.length === 0) return false;
    return isOperator(expression[expression.length - 1]);
}

/**
 * Get the last character of the expression.
 */
function lastChar() {
    return expression.length > 0 ? expression[expression.length - 1] : '';
}

/**
 * Handle backspace - remove last token (could be multi-char function name).
 */
function handleBackspace() {
    if (expression.length === 0) return;

    // Check if expression ends with a known function name
    const funcNames = ['sin(', 'cos(', 'tan(', 'log(', 'sqrt(', 'ln('];
    for (const fn of funcNames) {
        if (expression.endsWith(fn)) {
            expression = expression.slice(0, -fn.length);
            return;
        }
    }

    // Remove last character
    expression = expression.slice(0, -1);
}

/**
 * Handle a button press or keyboard input.
 * @param {string} action - 'clear', 'backspace', 'equals', 'func', 'append'
 * @param {string} value - The value to append or function to apply
 */
function handleInput(action, value) {
    // Play click sound
    if (soundEnabled) playClickSound();

    switch (action) {
        case 'clear':
            expression = '';
            lastResult = '0';
            justEvaluated = false;
            resultEl.textContent = '0';
            resultEl.classList.remove('error', 'preview');
            expressionEl.textContent = '';
            adjustFontSizes();
            return;

        case 'backspace':
            if (justEvaluated) {
                // After evaluation, backspace clears
                expression = '';
                justEvaluated = false;
                resultEl.textContent = '0';
                resultEl.classList.remove('error', 'preview');
                expressionEl.textContent = '';
                adjustFontSizes();
                return;
            }
            handleBackspace();
            break;

        case 'equals':
            if (expression.length === 0) return;
            const result = evaluateExpression(expression);
            showResult(result);
            justEvaluated = true;
            return;

        case 'func':
            // Scientific function like sin(, cos(, etc.
            if (justEvaluated) {
                // Wrap the last result in the function
                expression = value + lastResult;
                justEvaluated = false;
            } else {
                expression += value;
            }
            break;

        case 'append':
            // Determine how to handle based on current state
            if (justEvaluated) {
                if (isOperator(value)) {
                    // Continue building with the result
                    expression = lastResult + value;
                } else if (value === '(' || value === '^' || value === '^2') {
                    // Start new expression with result
                    expression = lastResult + value;
                } else {
                    // Start fresh
                    expression = value;
                }
                justEvaluated = false;
            } else {
                // Smart operator handling: replace if double operator
                if (isOperator(value) && lastCharIsOperator()) {
                    expression = expression.slice(0, -1) + value;
                } else {
                    // Prevent leading operators (except minus for negative)
                    if (expression.length === 0 && isOperator(value) && value !== '−') {
                        return;
                    }
                    expression += value;
                }
            }
            break;
    }

    updateDisplay();
}


// ─────────────────────────────────────────────
// EVENT LISTENERS - BUTTON CLICKS
// ─────────────────────────────────────────────

/**
 * Attach click handlers to all calculator buttons.
 */
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const action = this.dataset.action;
        const value = this.dataset.value || '';

        // Add visual press effect
        this.classList.add('pressing');
        setTimeout(() => this.classList.remove('pressing'), 150);

        handleInput(action, value);
    });
});


// ─────────────────────────────────────────────
// EVENT LISTENERS - KEYBOARD INPUT
// ─────────────────────────────────────────────

/**
 * Map keyboard keys to calculator actions.
 */
document.addEventListener('keydown', function (e) {
    const key = e.key;

    // Prevent default for calculator keys
    const calculatorKeys = [
        '0','1','2','3','4','5','6','7','8','9',
        '+','-','*','/','%','.',',',
        'Enter','=','Backspace','Delete','Escape',
        '(',')','^','!'
    ];

    if (calculatorKeys.includes(key) || key === 'Enter') {
        e.preventDefault();
    }

    // Map key to action
    switch (key) {
        // Numbers
        case '0': case '1': case '2': case '3': case '4':
        case '5': case '6': case '7': case '8': case '9':
            handleInput('append', key);
            highlightButton('[data-value="' + key + '"].num');
            break;

        // Operators
        case '+':
            handleInput('append', '+');
            highlightButton('[data-value="+"]');
            break;
        case '-':
            handleInput('append', '−');
            highlightButton('[data-value="−"]');
            break;
        case '*':
            handleInput('append', '×');
            highlightButton('[data-value="×"]');
            break;
        case '/':
            e.preventDefault();
            handleInput('append', '÷');
            highlightButton('[data-value="÷"]');
            break;

        // Decimal
        case '.':
        case ',':
            handleInput('append', '.');
            highlightButton('[data-value="."]');
            break;

        // Percent
        case '%':
            handleInput('append', '%');
            highlightButton('[data-value="%"]');
            break;

        // Power
        case '^':
            handleInput('append', '^');
            highlightButton('[data-value="^"]');
            break;

        // Factorial
        case '!':
            handleInput('append', '!');
            highlightButton('[data-value="!"]');
            break;

        // Parentheses
        case '(':
            handleInput('append', '(');
            highlightButton('[data-value="("]');
            break;
        case ')':
            handleInput('append', ')');
            highlightButton('[data-value=")"]');
            break;

        // Evaluate
        case 'Enter':
        case '=':
            handleInput('equals');
            highlightButton('[data-action="equals"]');
            break;

        // Backspace
        case 'Backspace':
            handleInput('backspace');
            highlightButton('[data-action="backspace"]');
            break;

        // Clear
        case 'Escape':
        case 'Delete':
            handleInput('clear');
            highlightButton('[data-action="clear"]');
            break;
    }
});

/**
 * Visually highlight a button when its keyboard shortcut is pressed.
 * @param {string} selector - CSS selector for the button
 */
function highlightButton(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
        btn.classList.add('pressing');
        setTimeout(() => btn.classList.remove('pressing'), 150);
    }
}


// ─────────────────────────────────────────────
// SOUND EFFECT
// ─────────────────────────────────────────────

/**
 * Play a subtle click sound using the Web Audio API.
 */
function playClickSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume context if suspended (browser autoplay policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Short, subtle click
        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.06);
    } catch (err) {
        // Silently fail if audio isn't available
    }
}


// ─────────────────────────────────────────────
// TOGGLE HANDLERS
// ─────────────────────────────────────────────

/**
 * Sound Toggle
 */
soundToggle.addEventListener('click', function () {
    soundEnabled = !soundEnabled;
    this.querySelector('.toggle-icon').textContent = soundEnabled ? '🔊' : '🔇';

    // Play a click to confirm sound is on
    if (soundEnabled) {
        playClickSound();
    }
});

/**
 * Dark Mode Toggle
 */
darkModeToggle.addEventListener('click', function () {
    darkMode = !darkMode;
    document.body.classList.toggle('dark', darkMode);
    this.querySelector('.toggle-icon').textContent = darkMode ? '☀️' : '🌙';
});


// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

/**
 * Initialize the calculator on page load.
 */
function init() {
    expression = '';
    lastResult = '0';
    justEvaluated = false;
    resultEl.textContent = '0';
    expressionEl.textContent = '';

    // Check user's color scheme preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        darkMode = true;
        document.body.classList.add('dark');
        darkModeToggle.querySelector('.toggle-icon').textContent = '☀️';
    }

    adjustFontSizes();
}

// Run initialization
init();
