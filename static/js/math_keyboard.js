/**
 * On-screen Mathematical Symbol Keyboard
 * Docked panel with pill-style tab bar and responsive grid keys.
 */

const MATH_TABS = [
    {
        id: 'basic', icon: '±', label: 'Basic',
        keys: [
            { sym: '+', t: 'Plus' }, { sym: '−', t: 'Minus' },
            { sym: '×', t: 'Multiply' }, { sym: '÷', t: 'Divide' },
            { sym: '=', t: 'Equals' }, { sym: '≠', t: 'Not equal' },
            { sym: '±', t: 'Plus-minus' }, { sym: '%', t: 'Percent' },
            { sym: '<', t: 'Less than' }, { sym: '>', t: 'Greater than' },
            { sym: '≤', t: 'Less or equal' }, { sym: '≥', t: 'Greater or equal' },
            { sym: '≈', t: 'Approximately' }, { sym: '(', t: 'Left paren' },
            { sym: ')', t: 'Right paren' }, { sym: '/', t: 'Fraction' },
        ]
    },
    {
        id: 'powers', icon: 'x²', label: 'Powers',
        keys: [
            { sym: '²', t: 'Squared' }, { sym: '³', t: 'Cubed' },
            { sym: 'ⁿ', t: 'Nth power' }, { sym: '√', t: 'Square root' },
            { sym: '∛', t: 'Cube root' }, { sym: 'xⁿ', t: 'X to n', ins: 'xⁿ' },
            { sym: '½', t: 'One half' }, { sym: '⅓', t: 'One third' },
            { sym: '¼', t: 'One quarter' }, { sym: '⅔', t: 'Two thirds' },
            { sym: '₀', t: 'Sub 0' }, { sym: '₁', t: 'Sub 1' },
            { sym: '₂', t: 'Sub 2' }, { sym: '₃', t: 'Sub 3' },
            { sym: 'ₙ', t: 'Sub n' }, { sym: 'ₓ', t: 'Sub x' },
        ]
    },
    {
        id: 'trig', icon: 'sin', label: 'Trig',
        keys: [
            { sym: 'sin', t: 'Sine', ins: 'sin(' },
            { sym: 'cos', t: 'Cosine', ins: 'cos(' },
            { sym: 'tan', t: 'Tangent', ins: 'tan(' },
            { sym: 'cot', t: 'Cotangent', ins: 'cot(' },
            { sym: 'sec', t: 'Secant', ins: 'sec(' },
            { sym: 'csc', t: 'Cosecant', ins: 'csc(' },
            { sym: 'sin⁻¹', t: 'Inverse sine', ins: 'sin⁻¹(' },
            { sym: 'cos⁻¹', t: 'Inverse cosine', ins: 'cos⁻¹(' },
            { sym: 'tan⁻¹', t: 'Inverse tangent', ins: 'tan⁻¹(' },
            { sym: 'log', t: 'Logarithm', ins: 'log(' },
            { sym: 'ln', t: 'Natural log', ins: 'ln(' },
        ]
    },
    {
        id: 'greek', icon: 'π', label: 'Greek',
        keys: [
            { sym: 'π', t: 'Pi' }, { sym: 'θ', t: 'Theta' },
            { sym: 'α', t: 'Alpha' }, { sym: 'β', t: 'Beta' },
            { sym: 'γ', t: 'Gamma' }, { sym: 'Δ', t: 'Delta' },
            { sym: 'λ', t: 'Lambda' }, { sym: 'σ', t: 'Sigma' },
            { sym: 'μ', t: 'Mu' }, { sym: 'φ', t: 'Phi' },
            { sym: 'ω', t: 'Omega' }, { sym: 'ε', t: 'Epsilon' },
        ]
    },
    {
        id: 'advanced', icon: '∑', label: 'Calculus',
        keys: [
            { sym: '∞', t: 'Infinity' }, { sym: '∑', t: 'Summation' },
            { sym: '∫', t: 'Integral' }, { sym: '∂', t: 'Partial' },
            { sym: '∈', t: 'Element of' }, { sym: '∉', t: 'Not element' },
            { sym: '∪', t: 'Union' }, { sym: '∩', t: 'Intersection' },
            { sym: '∅', t: 'Empty set' }, { sym: '∴', t: 'Therefore' },
            { sym: '∠', t: 'Angle' }, { sym: '°', t: 'Degree' },
            { sym: '∝', t: 'Proportional' }, { sym: '‖', t: 'Parallel' },
            { sym: '⊥', t: 'Perpendicular' },
        ]
    }
];

class MathKeyboard {
    constructor(targetSelector) {
        this.targetSelector = targetSelector;
        this.open = false;
        this.activeTab = 'basic';
        this._build();
    }

    _build() {
        // Wrapper inserted after the target input
        const target = document.querySelector(this.targetSelector);
        const wrapper = document.createElement('div');
        wrapper.className = 'math-kb';
        wrapper.id = 'mathKbRoot';

        // Header row: title + collapse toggle
        const header = document.createElement('div');
        header.className = 'math-kb-header';
        header.innerHTML = `
            <span class="math-kb-title">⌨ Math Symbols</span>
            <button type="button" class="math-kb-toggle" id="mathKbToggle" title="Toggle keyboard">▾</button>
        `;
        header.querySelector('#mathKbToggle').addEventListener('click', () => this._toggle());
        wrapper.appendChild(header);

        // Collapsible body
        const body = document.createElement('div');
        body.className = 'math-kb-body';
        body.id = 'mathKbBody';

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'math-kb-tabs';
        for (const tab of MATH_TABS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'math-kb-tab' + (tab.id === this.activeTab ? ' active' : '');
            btn.dataset.tab = tab.id;
            btn.textContent = tab.label;
            btn.addEventListener('click', () => this._switchTab(tab.id));
            tabBar.appendChild(btn);
        }
        body.appendChild(tabBar);

        // Key grids (one per tab)
        for (const tab of MATH_TABS) {
            const pane = document.createElement('div');
            pane.className = 'math-kb-pane' + (tab.id === this.activeTab ? ' active' : '');
            pane.id = 'mkPane_' + tab.id;

            const grid = document.createElement('div');
            grid.className = 'math-kb-grid';
            for (const key of tab.keys) {
                const k = document.createElement('button');
                k.type = 'button';
                k.className = 'math-kb-key' + (key.sym.length > 2 ? ' math-kb-key--wide' : '');
                k.textContent = key.sym;
                k.title = key.t;
                k.addEventListener('click', (e) => {
                    e.preventDefault();
                    this._insert(key.ins || key.sym);
                    k.classList.add('math-kb-key--flash');
                    setTimeout(() => k.classList.remove('math-kb-key--flash'), 150);
                });
                grid.appendChild(k);
            }
            pane.appendChild(grid);
            body.appendChild(pane);
        }

        wrapper.appendChild(body);

        // Insert keyboard right after the target input's parent form-group
        if (target) {
            const formGroup = target.closest('.question-answer') || target.parentElement;
            formGroup.insertAdjacentElement('afterend', wrapper);
        } else {
            document.body.appendChild(wrapper);
        }
    }

    _toggle() {
        this.open = !this.open;
        const body = document.getElementById('mathKbBody');
        const btn = document.getElementById('mathKbToggle');
        if (body) body.classList.toggle('collapsed', this.open);
        if (btn) btn.textContent = this.open ? '▸' : '▾';
    }

    _switchTab(tabId) {
        this.activeTab = tabId;
        document.querySelectorAll('.math-kb-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.tab === tabId)
        );
        document.querySelectorAll('.math-kb-pane').forEach(p =>
            p.classList.toggle('active', p.id === 'mkPane_' + tabId)
        );
    }

    _insert(text) {
        const el = document.querySelector(this.targetSelector);
        if (!el) return;
        el.focus();
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        el.value = el.value.slice(0, start) + text + el.value.slice(end);
        const pos = start + text.length;
        el.setSelectionRange(pos, pos);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
