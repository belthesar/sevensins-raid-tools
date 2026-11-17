const tools = [
  {
    id: 'inventory-parser',
    name: 'Inventory Parser',
    render: renderInventoryParser,
  },
];

let activeToolId = tools[0].id;

function init() {
  renderTabs();
  renderActiveTool();
}

function renderTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  tools.forEach(tool => {
    const btn = document.createElement('button');
    btn.className = `tab${tool.id === activeToolId ? ' active' : ''}`;
    btn.textContent = tool.name;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', tool.id === activeToolId ? 'true' : 'false');
    btn.addEventListener('click', () => {
      activeToolId = tool.id;
      renderTabs();
      renderActiveTool();
    });
    nav.appendChild(btn);
  });
}

function renderActiveTool() {
  const app = document.getElementById('app');
  const tool = tools.find(t => t.id === activeToolId);
  app.innerHTML = '';
  if (tool) {
    const container = document.createElement('div');
    container.className = 'tool';
    tool.render(container);
    app.appendChild(container);
  }
}

// ---------- Inventory Parser ----------

const STORAGE_KEY = 'seven-sins-raid-tools.inventory.raw';
const OPTIONS_KEY = 'seven-sins-raid-tools.inventory.options';

const DEFAULT_OPTIONS = {
  removeEmpty: true,
  preserveColors: true,
};

function loadRawInput() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveRawInput(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

function loadOptions() {
  try {
    const saved = localStorage.getItem(OPTIONS_KEY);
    return saved ? { ...DEFAULT_OPTIONS, ...JSON.parse(saved) } : DEFAULT_OPTIONS;
  } catch {
    return DEFAULT_OPTIONS;
  }
}

function saveOptions(options) {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

const SAMPLE_INVENTORY =
`Weapon: \x1b[37mAdroit Mythril Rod of Insight\x1b[0m \x1b[32m[II]\x1b[0m \x1b[32m(+8 INT, +11 DEX)\x1b[0m
Weapon: \x1b[37mInsightful Steel Rod of Precision\x1b[0m \x1b[32m[II]\x1b[0m \x1b[32m(+6 INT, +5 DEX)\x1b[0m
Shield: \x1b[37mStalwart Mythril Shield of Strength\x1b[0m \x1b[37m[I]\x1b[0m \x1b[32m(+5 STR, +11 DEF)\x1b[0m
Helm: \x1b[37mElusive Bronze Helm of Wisdom\x1b[0m \x1b[37m[I]\x1b[0m \x1b[32m(+2 WIS, +2 DODGE)\x1b[0m
Chest: \x1b[37mFast Bronze Armor of Evasion\x1b[0m \x1b[32m[II]\x1b[0m \x1b[32m(+2 ASPD, +2 DODGE)\x1b[0m
Legs: \x1b[37mElusive Mage's Leggings of Slaying\x1b[0m \x1b[32m[II]\x1b[0m \x1b[32m(+3 CRIT, +9 DODGE)\x1b[0m
Dye bag: empty`;

function stripDiscordCodes(text) {
  // Discord/ANSI color codes: ESC[...m
  // The ESC char may be the literal \x1B, or pasted as ^[, or rendered as "\u001b".
  // This regex handles ESC, ^[, or the two-char sequence "[" followed by digits/semicolons and "m".
  return text
    .replace(/\x1B\[[0-9;]*m/g, '')
    .replace(/\^\[[0-9;]*m/g, '')
    .replace(/\[[0-9;]*m/g, '');
}

function parseInventory(input, removeEmpty) {
  let cleaned = stripDiscordCodes(input);
  if (removeEmpty) {
    cleaned = cleaned
      .split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
  }
  return cleaned;
}

function countItems(text) {
  return text.split('\n').filter(line => line.trim() !== '').length;
}

function wrapInCodeBlock(text, language = '') {
  const opener = language ? '```' + language : '```';
  return opener + '\n' + text + '\n```';
}

function renderInventoryParser(container) {
  const template = document.getElementById('tpl-inventory-parser');
  const clone = template.content.cloneNode(true);
  container.appendChild(clone);

  // Collect references by data-ref attribute.
  const refs = {};
  container.querySelectorAll('[data-ref]').forEach(el => {
    refs[el.dataset.ref] = el;
  });

  const { 'raw-input': input, 'clean-output': output, 'remove-empty': removeEmptyBox, 'preserve-colors': preserveColorsBox, 'parser-status': status, 'load-sample': loadSampleBtn, 'copy-output': copyOutputBtn } = refs;

  function update() {
    let cleaned;
    if (preserveColorsBox.checked) {
      // Keep ANSI escape codes so Discord can render them in an ansi code block.
      cleaned = removeEmptyBox.checked
        ? input.value.split('\n').filter(line => line.trim() !== '').join('\n')
        : input.value;
      output.textContent = cleaned.length ? wrapInCodeBlock(cleaned, 'ansi') : '';
    } else {
      cleaned = parseInventory(input.value, removeEmptyBox.checked);
      output.textContent = cleaned.length ? wrapInCodeBlock(cleaned) : '';
    }
    const itemCount = countItems(cleaned);
    status.textContent = cleaned.length
      ? `${itemCount} line${itemCount === 1 ? '' : 's'} parsed`
      : '';
    status.className = 'status';
  }

  function syncOptions() {
    saveOptions({
      removeEmpty: removeEmptyBox.checked,
      preserveColors: preserveColorsBox.checked,
    });
  }

  input.addEventListener('input', () => {
    saveRawInput(input.value);
    update();
  });
  removeEmptyBox.addEventListener('change', () => {
    syncOptions();
    update();
  });
  preserveColorsBox.addEventListener('change', () => {
    syncOptions();
    update();
  });

  loadSampleBtn.addEventListener('click', () => {
    input.value = SAMPLE_INVENTORY;
    saveRawInput(input.value);
    update();
  });

  copyOutputBtn.addEventListener('click', async () => {
    const text = output.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied cleaned output to clipboard!';
      status.className = 'status success';
      setTimeout(update, 1800);
    } catch (err) {
      status.textContent = 'Could not copy to clipboard.';
      status.className = 'status error';
    }
  });

  // Restore saved options and raw input, or fall back to defaults / placeholder hint.
  const options = loadOptions();
  removeEmptyBox.checked = options.removeEmpty;
  preserveColorsBox.checked = options.preserveColors;
  input.value = loadRawInput();
  update();
}

// Boot the app.
init();
