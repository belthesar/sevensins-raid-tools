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
    const isActive = tool.id === activeToolId;
    btn.className = isActive
      ? 'button button-sm bg-primary-1 border-primary-1 text-white hover-bg-primary-2'
      : 'button button-sm bg-transparent border-transparent text-secondary hover-text-primary';
    btn.textContent = tool.name;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
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

const CATEGORY_ORDER = ['Weapons', 'Head Gear', 'Leg Gear', 'Chest Gear', 'Misc Items'];

function detectCategory(line) {
  const trimmed = line.trim();
  if (/^(Weapon|Two-handed):/i.test(trimmed)) return 'Weapons';
  if (/^Helm:/i.test(trimmed)) return 'Head Gear';
  if (/^Legs:/i.test(trimmed)) return 'Leg Gear';
  if (/^Chest:/i.test(trimmed)) return 'Chest Gear';
  return 'Misc Items';
}

function stripPrefix(line, category) {
  const trimmed = line.trim();
  // Keep prefixes for Weapons and Misc Items; strip for armour slots.
  if (category === 'Weapons' || category === 'Misc Items') {
    return trimmed;
  }
  return trimmed
    .replace(/^Helm:\s*/i, '')
    .replace(/^Legs:\s*/i, '')
    .replace(/^Chest:\s*/i, '');
}

function parseInventory(input, removeEmpty, preserveColors) {
  let lines = input.split('\n');
  if (removeEmpty) {
    lines = lines.filter(line => line.trim() !== '');
  }

  if (!preserveColors) {
    lines = lines.map(stripDiscordCodes);
  }

  const groups = {};
  for (const category of CATEGORY_ORDER) {
    groups[category] = [];
  }

  for (const line of lines) {
    const category = detectCategory(line);
    groups[category].push(stripPrefix(line, category));
  }

  return groups;
}

function countItems(groups) {
  return Object.values(groups).reduce((sum, items) => sum + items.length, 0);
}

function wrapInCodeBlock(text, language = '') {
  const opener = language ? '```' + language : '```';
  return opener + '\n' + text + '\n```';
}

function formatSection(items, language) {
  return wrapInCodeBlock(items.join('\n'), language);
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

  const { 'raw-input': input, 'output-sections': outputSections, 'remove-empty': removeEmptyBox, 'preserve-colors': preserveColorsBox, 'parser-status': status, 'load-sample': loadSampleBtn } = refs;

  async function copyText(text, button) {
    if (!text) return;
    const originalText = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied!';
      status.textContent = 'Copied section to clipboard.';
      status.className = 'text-body-3 margin-top-12 text-green-1';
    } catch (err) {
      button.textContent = 'Failed';
      status.textContent = 'Could not copy to clipboard.';
      status.className = 'text-body-3 margin-top-12 text-red-1';
    }
    setTimeout(() => {
      button.textContent = originalText;
      status.className = 'text-body-3 margin-top-12 text-secondary';
      status.textContent = '';
    }, 1800);
  }

  function renderSection(category, items) {
    const language = preserveColorsBox.checked ? 'ansi' : '';
    const section = document.createElement('div');
    section.className = 'bg-sunken border border-subtle rounded-8 padding-12';

    const header = document.createElement('div');
    header.className = 'flex flex-items-center flex-justify-between margin-bottom-8';

    const title = document.createElement('span');
    title.className = 'text-body-3 font-weight-600 text-secondary';
    title.textContent = category;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'button button-sm bg-primary-1 border-primary-1 text-white hover-bg-primary-2';
    copyBtn.textContent = 'Copy';

    const pre = document.createElement('pre');
    pre.className = 'bg-base border border-subtle rounded-8 padding-12 text-body-2 text-primary overflow-auto margin-0';
    pre.style.minHeight = '80px';
    pre.style.maxHeight = '240px';
    pre.textContent = formatSection(items, language);

    copyBtn.addEventListener('click', () => copyText(pre.textContent, copyBtn));

    header.appendChild(title);
    header.appendChild(copyBtn);
    section.appendChild(header);
    section.appendChild(pre);
    return section;
  }

  function update() {
    outputSections.innerHTML = '';
    const groups = parseInventory(input.value, removeEmptyBox.checked, preserveColorsBox.checked);
    const itemCount = countItems(groups);

    for (const category of CATEGORY_ORDER) {
      const items = groups[category];
      if (!items || items.length === 0) continue;
      outputSections.appendChild(renderSection(category, items));
    }

    status.textContent = itemCount
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} parsed`
      : '';
    status.className = 'text-body-3 margin-top-12 text-secondary';
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

  // Restore saved options and raw input, or fall back to defaults / placeholder hint.
  const options = loadOptions();
  removeEmptyBox.checked = options.removeEmpty;
  preserveColorsBox.checked = options.preserveColors;
  input.value = loadRawInput();
  update();
}

// Boot the app.
init();
