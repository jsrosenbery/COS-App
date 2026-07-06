const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadEnrollmentModules() {
  const context = {
    window: {},
    console
  };
  context.window.window = context.window;
  vm.createContext(context);
  ['js/core/csv-normalizer.js', 'js/core/modality-normalizer.js', 'js/core/section-model.js', 'js/enrollment/metrics.js', 'js/enrollment/filters.js', 'js/enrollment/consolidation.js', 'js/enrollment/dashboard.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return context.window;
}

function loadEnrollmentAnalyticsRuntime() {
  const context = {
    window: {},
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() { return null; },
      querySelectorAll() { return []; }
    },
    console
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  ['js/core/dom-utils.js', 'js/core/csv-normalizer.js', 'js/core/modality-normalizer.js', 'js/core/section-model.js', 'js/enrollment/metrics.js', 'js/enrollment/filters.js', 'js/enrollment/consolidation.js', 'js/enrollment/dashboard.js', 'js/enrollment/trend-projection.js', 'js/enrollment-analytics.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return context.window;
}

function loadCoreModules() {
  return {
    csv: require('../js/core/csv-normalizer.js'),
    modality: require('../js/core/modality-normalizer.js'),
    sectionModel: require('../js/core/section-model.js')
  };
}

function loadCollapsibleUtilsRuntime() {
  class ClassList {
    constructor(owner) {
      this.owner = owner;
      this.values = new Set();
    }
    add(...values) {
      values.forEach(value => {
        if (value) this.values.add(value);
      });
      this.owner.className = [...this.values].join(' ');
    }
    remove(...values) {
      values.forEach(value => this.values.delete(value));
      this.owner.className = [...this.values].join(' ');
    }
    toggle(value, force) {
      const shouldAdd = force === undefined ? !this.values.has(value) : Boolean(force);
      if (shouldAdd) this.add(value);
      else this.remove(value);
      return shouldAdd;
    }
    contains(value) {
      return this.values.has(value);
    }
    setFromString(value) {
      this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
    }
  }
  class Element {
    constructor(tagName, ownerDocument) {
      this.tagName = tagName.toUpperCase();
      this.ownerDocument = ownerDocument;
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this.attributes = {};
      this.style = {};
      this.eventHandlers = {};
      this.hidden = false;
      this.textContent = '';
      this._className = '';
      this.classList = new ClassList(this);
    }
    set className(value) {
      this._className = String(value || '');
      this.classList?.setFromString(this._className);
    }
    get className() {
      return this._className;
    }
    get firstChild() {
      return this.children[0] || null;
    }
    set id(value) {
      this.attributes.id = String(value || '');
      if (this.ownerDocument) this.ownerDocument.elementsById.set(this.attributes.id, this);
    }
    get id() {
      return this.attributes.id || '';
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    append(...children) {
      children.forEach(child => this.appendChild(child));
    }
    insertBefore(child, before) {
      child.parentNode = this;
      const index = this.children.indexOf(before);
      if (index >= 0) this.children.splice(index, 0, child);
      else this.children.push(child);
      return child;
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'id') this.id = value;
    }
    getAttribute(name) {
      return this.attributes[name] ?? null;
    }
    addEventListener(event, handler) {
      this.eventHandlers[event] = handler;
    }
    click() {
      this.eventHandlers.click?.({ target: this });
    }
    matches(selector) {
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      if (selector.includes(':not')) {
        const [base, notPart] = selector.split(':not');
        const notSelector = notPart.replace(/[()]/g, '');
        return this.matches(base) && !this.matches(notSelector);
      }
      if (selector.startsWith('[')) {
        const attr = selector.slice(1, -1).split('=')[0].replace(/^data-/, '');
        const key = attr.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        return this.dataset[key] !== undefined;
      }
      return this.tagName.toLowerCase() === selector.toLowerCase();
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
      const selectors = selector.split(',').map(item => item.trim()).filter(Boolean);
      const out = [];
      const visit = node => {
        node.children.forEach(child => {
          if (selectors.some(item => child.matches(item))) out.push(child);
          visit(child);
        });
      };
      visit(this);
      return out;
    }
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches(selector)) return node;
        node = node.parentNode;
      }
      return null;
    }
  }
  const document = {
    elementsById: new Map(),
    body: null,
    createElement(tag) {
      return new Element(tag, document);
    },
    getElementById(id) {
      return document.elementsById.get(id) || null;
    },
    querySelector(selector) {
      return document.body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return document.body.querySelectorAll(selector);
    }
  };
  document.body = document.createElement('body');
  const storage = new Map();
  const context = {
    window: {
      document,
      localStorage: {
        getItem: key => (storage.has(key) ? storage.get(key) : null),
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key)
      }
    },
    document,
    console
  };
  context.window.window = context.window;
  vm.createContext(context);
  ['js/core/metric-definitions.js', 'js/core/metric-help.js', 'js/shared/utils.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return { utils: context.window.COSUtils, document, storage };
}

function loadScheduleAppRuntime() {
  const elements = new Map();
  function element(id = '') {
    if (elements.has(id)) return elements.get(id);
    const classValues = new Set();
    const el = {
      _id: id,
      value: '',
      checked: false,
      multiple: false,
      selectedOptions: [],
      options: [],
      style: {},
      dataset: {},
      eventHandlers: {},
      hidden: false,
      classList: {
        add(...values) { values.forEach(value => classValues.add(value)); },
        remove(...values) { values.forEach(value => classValues.delete(value)); },
        toggle(value, force) {
          const shouldAdd = force === undefined ? !classValues.has(value) : Boolean(force);
          if (shouldAdd) classValues.add(value);
          else classValues.delete(value);
          return shouldAdd;
        },
        contains(value) { return classValues.has(value); }
      },
      appendChild(child) {
        this.children = this.children || [];
        if (child && typeof child === 'object') child.parentElement = this;
        this.children.push(child);
        return child;
      },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      replaceChildren(...children) { this.children = children; },
      insertRow() { const row = element(`${id}:row:${Math.random()}`); row.insertCell = () => element(`${id}:cell:${Math.random()}`); return row; },
      insertCell() { return element(`${id}:cell:${Math.random()}`); },
      addEventListener(event, handler) { this.eventHandlers[event] = handler; },
      click() { this.eventHandlers.click?.({ target: this }); },
      removeEventListener() {},
      remove() {},
      querySelector() { return element(`${id}:query`); },
      querySelectorAll() { return []; },
      setAttribute(name, value) { this[name] = value; },
      getAttribute(name) { return this[name]; },
      getBoundingClientRect() { return { width: 800, height: 400, top: 0, right: 800, bottom: 400, left: 0 }; },
      getContext() { return {}; },
      textContent: '',
      innerHTML: ''
    };
    Object.defineProperty(el, 'id', {
      get() { return this._id; },
      set(value) {
        this._id = String(value || '');
        elements.set(this._id, this);
      }
    });
    Object.defineProperty(el, 'className', {
      get() { return [...classValues].join(' '); },
      set(value) {
        classValues.clear();
        String(value || '').split(/\s+/).filter(Boolean).forEach(className => classValues.add(className));
      }
    });
    elements.set(id, el);
    return el;
  }
  const context = {
    window: {
      COS_APP_CONFIG: { backendBaseUrl: '' },
      ROOM_CATALOG: [],
      CAL_GETC_MAPPING: [],
      CURRICULUM_CROSSWALK: []
    },
    document: {
      getElementById: id => element(id),
      querySelector: selector => element(selector),
      querySelectorAll: () => [],
      createElement: tag => element(`created:${tag}:${Math.random()}`),
      addEventListener(event, handler) {
        if (event === 'DOMContentLoaded') handler();
      }
    },
    Option: function Option(label, value, defaultSelected, selected) {
      return { label, textContent: label, value, defaultSelected: Boolean(defaultSelected), selected: Boolean(selected) };
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    fetch: () => Promise.resolve({ ok: false, json: async () => ({ data: [] }), text: async () => '' }),
    alert() {},
    confirm() { return false; },
    console,
    Papa: { parse() { return { data: [] }; }, unparse(rows) { return JSON.stringify(rows); } },
    Choices: function Choices() {
      return { setChoices() {}, destroy() {}, removeActiveItems() {}, clearStore() {}, getValue() { return []; } };
    },
    $: function $() {
      const tableApi = {
        destroy() {},
        on() { return tableApi; },
        search() { return tableApi; },
        draw() { return tableApi; },
        clear() { return tableApi; },
        rows() {
          return {
            add() { return tableApi; },
            data() { return { toArray() { return []; } }; }
          };
        }
      };
      tableApi.rows.add = () => tableApi;
      return { DataTable() { return tableApi; } };
    },
    Blob: function Blob() {},
    Chart: function Chart() { return { destroy() {}, update() {} }; },
    URL: { createObjectURL() { return ''; }, revokeObjectURL() {} },
    setTimeout,
    clearTimeout
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.fetch = context.fetch;
  context.window.Papa = context.Papa;
  context.$.fn = { dataTable: { render: { text: () => value => value }, ext: { search: [] } } };
  context.window.$ = context.$;
  context.window.jQuery = context.$;
  context.window.COSUtils = { renderStandardMethodologyPanel() {} };
  vm.createContext(context);
  ['js/core/csv-normalizer.js', 'js/core/modality-normalizer.js', 'js/core/section-model.js', 'js/core/metric-definitions.js', 'js/core/metric-help.js', 'js/app.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return Object.assign(context.window.COSScheduleApp.modalityBalanceTestHooks, {
    roomCatalogTestHooks: context.window.COSScheduleApp.roomCatalogTestHooks,
    testDocument: context.document
  });
}

function loadConfigModule() {
  const context = {
    window: {},
    location: { hostname: 'localhost' }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/config.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'js/config.js' });
  return context.window.COS_APP_CONFIG;
}

function section(overrides = {}) {
  return {
    term: 'FALL 2026',
    subject: 'PS',
    course: '200M',
    campus: 'VIS',
    modality: 'IN PERSON',
    dayPattern: 'MW',
    days: ['MO', 'WE'],
    start: '09:00',
    end: '10:15',
    timeBlock: '09:00-09:59',
    crn: overrides.crn || '10000',
    cap: 30,
    actual: 12,
    census: 12,
    ...overrides
  };
}

test('metrics use census as the planning enrollment basis', () => {
  const { COSEnrollmentMetrics } = loadEnrollmentModules();
  const row = section({ actual: 18, census: 24, cap: 30 });

  assert.equal(COSEnrollmentMetrics.censusEnrollment(row), 24);
  assert.equal(COSEnrollmentMetrics.finalEnrollment(row), 18);
  assert.equal(COSEnrollmentMetrics.expectedEnrollment(row), 24);
  assert.equal(COSEnrollmentMetrics.expectedOpenSeats(row), 6);
  assert.equal(COSEnrollmentMetrics.expectedFillRate(row), 0.8);
});

test('config exposes future enrollment access feature placeholders', () => {
  const config = loadConfigModule();

  assert.equal(config.features.deanDashboardAccess, true);
  assert.equal(config.features.enrollmentManagementWorkbench, false);
  assert.equal(config.features.scenarioModeling, false);
  assert.equal(config.features.scheduleSimulation, false);
  assert.equal(config.features.enrollmentManagement, true);
});

test('current CSV data without milestone fields still normalizes for attrition', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    CRN: '12345',
    Subject: 'PS',
    Course: '200M',
    Capacity: '30',
    ACTUAL_ENROLL: '18',
    CENSUS_ENROLL: '24'
  });

  assert.equal(row.actual, 18);
  assert.equal(row.census, 24);
  assert.equal(row.firstDay, null);
  assert.equal(row.census1, 24);
  assert.equal(row.census2, null);
  assert.equal(row.finalEnrollment, null);
});

test('shared CSV normalizer builds canonical section fields from all-columns seating rows', () => {
  const { csv, sectionModel } = loadCoreModules();
  const row = {
    TERM: 'Fall 2026',
    CRN: '12345',
    SUBJECT: 'engl',
    COURSE: 'c1000',
    'Instructional Method': '02S',
    DAYS: 'MW',
    'Start Time': '9:10 AM',
    'End Time': '10:25 AM',
    CENSUS_ENROLL: '27',
    CENSUS_ENROLL2: '-3',
    ACTUAL_ENROLL: '29',
    CAPACITY: '35',
    BUILDING: 'TCC',
    ROOM: '101'
  };

  const normalized = csv.normalizeCsvRow(row);
  const sectionRow = sectionModel.normalizeSection(row);

  assert.equal(normalized.term, 'FALL 2026');
  assert.equal(normalized.courseCode, 'ENGL C1000');
  assert.equal(normalized.invalidNegativeCensus2, true);
  assert.equal(normalized.census2, null);
  assert.deepEqual(sectionRow.days, ['MO', 'WE']);
  assert.equal(sectionRow.start, '09:10');
  assert.equal(sectionRow.end, '10:25');
  assert.equal(sectionRow.modality, 'IN PERSON');
  assert.equal(sectionRow.timeBlock, '09:00-09:59');
});

test('shared modality normalizer maps every known app instructional method code', () => {
  const { modality } = loadCoreModules();
  modality.KNOWN_CODES.inPerson.forEach(code => {
    assert.equal(modality.normalize(code, { INSTRUCTIONAL_METHOD_CODE: code }), 'IN PERSON', code);
    assert.equal(modality.displayLabel('IN PERSON'), 'In-Person');
  });
  modality.KNOWN_CODES.hybrid.forEach(code => {
    assert.equal(modality.normalize(code, { INSTRUCTIONAL_METHOD_CODE: code }), 'HYBRID', code);
  });
  modality.KNOWN_CODES.online.forEach(code => {
    assert.equal(modality.normalize(code, { INSTRUCTIONAL_METHOD_CODE: code }), 'ONLINE', code);
  });
  modality.KNOWN_CODES.omitted.forEach(code => {
    assert.equal(modality.normalize(code, { INSTRUCTIONAL_METHOD_CODE: code }), 'OMIT', code);
  });
});

test('shared modality normalizer stores unmapped codes as UNKNOWN diagnostics', () => {
  const { modality } = loadCoreModules();
  const rows = [
    { crn: '90001', subject: 'HIST', course: '018', instructionalMethod: 'ZZZ' },
    { crn: '90002', subject: 'MATH', course: '021', instructionalMethod: 'ZZZ' }
  ];
  const diagnostics = modality.diagnosticRows(rows);

  assert.equal(modality.normalize('ZZZ'), 'UNKNOWN');
  assert.equal(modality.isReportable('UNKNOWN'), false);
  assert.deepEqual(diagnostics.map(row => ({
    originalInstructionalMethodCode: row.originalInstructionalMethodCode,
    count: row.count,
    currentMappedCategory: row.currentMappedCategory
  })), [{ originalInstructionalMethodCode: 'ZZZ', count: 2, currentMappedCategory: 'UNKNOWN' }]);
  assert.match(diagnostics[0].exampleCrnsCourses, /90001 \/ HIST 018/);
});

test('canonical CRN deduplication prevents enrollment inflation from repeated meeting rows', () => {
  const { sectionModel } = loadCoreModules();
  const rows = [
    { Term: 'FALL 2026', CRN: '90001', Subject: 'MATH', Course: '021', CENSUS_ENROLL: '30', DAYS: 'MW', 'Start Time': '8:10', 'End Time': '9:25' },
    { Term: 'FALL 2026', CRN: '90001', Subject: 'MATH', Course: '021', CENSUS_ENROLL: '30', DAYS: 'MW', 'Start Time': '8:10', 'End Time': '9:25' },
    { Term: 'FALL 2026', CRN: '90002', Subject: 'MATH', Course: '021', CENSUS_ENROLL: '20', DAYS: 'TR', 'Start Time': '8:10', 'End Time': '9:25' }
  ];

  assert.equal(sectionModel.dedupeSectionsByCrn(rows).length, 2);
  assert.equal(sectionModel.sumEnrollmentByCrn(rows), 50);
});

test('student presence graph series counts enrollment by overlapping half-hour interval', () => {
  const { sectionModel } = loadCoreModules();
  const hours = [9, 9.5, 10, 10.5];
  const rows = [
    {
      Term: 'FALL 2026',
      CRN: '10001',
      Subject: 'ENGL',
      Course: 'C1000',
      DAYS: 'MW',
      'Start Time': '9:10 AM',
      'End Time': '10:25 AM',
      CENSUS_ENROLL: '20',
      ACTUAL_ENROLL: '25',
      'Instructional Method': '02S',
      BUILDING: 'TCC',
      ROOM: '101'
    },
    {
      Term: 'FALL 2026',
      CRN: '10001',
      Subject: 'ENGL',
      Course: 'C1000',
      DAYS: 'MW',
      'Start Time': '9:10 AM',
      'End Time': '10:25 AM',
      CENSUS_ENROLL: '20',
      ACTUAL_ENROLL: '25',
      'Instructional Method': '02S',
      BUILDING: 'TCC',
      ROOM: '101'
    },
    {
      Term: 'FALL 2026',
      CRN: '10002',
      Subject: 'MATH',
      Course: '021',
      DAYS: 'M',
      'Start Time': '9:45 AM',
      'End Time': '10:15 AM',
      ACTUAL_ENROLL: '5',
      'Instructional Method': 'IP',
      BUILDING: 'TCC',
      ROOM: '102'
    },
    {
      Term: 'FALL 2026',
      CRN: '10003',
      Subject: 'HIST',
      Course: '018',
      DAYS: 'M',
      'Start Time': '00:00',
      'End Time': '00:00',
      CENSUS_ENROLL: '40',
      'Instructional Method': 'ONL',
      BUILDING: 'ONLINE',
      ROOM: 'LIVE'
    }
  ];

  const presence = sectionModel.buildHalfHourPresenceSeries(rows, hours, { metric: 'presence' });
  const courseCount = sectionModel.buildHalfHourPresenceSeries(rows, hours, { metric: 'count' });

  assert.equal(presence['Monday-9'], 20);
  assert.equal(presence['Monday-9.5'], 25);
  assert.equal(presence['Monday-10'], 25);
  assert.equal(presence['Monday-10.5'], 0);
  assert.equal(presence['Wednesday-9'], 20);
  assert.equal(presence['Wednesday-9.5'], 20);
  assert.equal(courseCount['Monday-9.5'], 2);
  assert.equal(courseCount['Wednesday-9.5'], 1);
});

test('course duration dedupes CRN day time blocks but keeps distinct meeting blocks', () => {
  const { sectionModel } = loadCoreModules();
  const rows = [
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'M', 'Start Time': '8:00 AM', 'End Time': '9:00 AM', CENSUS_ENROLL: '20', 'Instructional Method': 'IP' },
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'M', 'Start Time': '8:00 AM', 'End Time': '9:00 AM', CENSUS_ENROLL: '20', 'Instructional Method': 'IP' },
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'M', 'Start Time': '9:00 AM', 'End Time': '10:00 AM', CENSUS_ENROLL: '20', 'Instructional Method': 'IP' },
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'W', 'Start Time': '8:00 AM', 'End Time': '9:00 AM', CENSUS_ENROLL: '20', 'Instructional Method': 'IP' }
  ];
  const courseCount = sectionModel.buildHalfHourPresenceSeries(rows, [8, 8.5, 9, 9.5], { metric: 'count' });

  assert.equal(courseCount['Monday-8'], 1);
  assert.equal(courseCount['Monday-8.5'], 1);
  assert.equal(courseCount['Monday-9'], 1);
  assert.equal(courseCount['Monday-9.5'], 1);
  assert.equal(courseCount['Wednesday-8'], 1);
  assert.equal(courseCount['Wednesday-8.5'], 1);
});

test('student presence applies enrollment once per distinct CRN day time block', () => {
  const { sectionModel } = loadCoreModules();
  const rows = [
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'M', 'Start Time': '8:00 AM', 'End Time': '9:00 AM', CENSUS_ENROLL: '20', ACTUAL_ENROLL: '25', 'Instructional Method': 'IP' },
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'M', 'Start Time': '8:00 AM', 'End Time': '9:00 AM', CENSUS_ENROLL: '20', ACTUAL_ENROLL: '25', 'Instructional Method': 'IP' },
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'M', 'Start Time': '9:00 AM', 'End Time': '10:00 AM', CENSUS_ENROLL: '20', ACTUAL_ENROLL: '25', 'Instructional Method': 'IP' },
    { Term: 'FALL 2026', CRN: '123', Subject: 'BIOL', Course: '001', DAYS: 'W', 'Start Time': '8:00 AM', 'End Time': '9:00 AM', CENSUS_ENROLL: '20', ACTUAL_ENROLL: '25', 'Instructional Method': 'IP' }
  ];
  const presence = sectionModel.buildHalfHourPresenceSeries(rows, [8, 8.5, 9, 9.5], { metric: 'presence' });

  assert.equal(presence['Monday-8'], 20);
  assert.equal(presence['Monday-8.5'], 20);
  assert.equal(presence['Monday-9'], 20);
  assert.equal(presence['Monday-9.5'], 20);
  assert.equal(presence['Wednesday-8'], 20);
  assert.equal(presence['Wednesday-8.5'], 20);
});

test('student presence report distinguishes scheduled offerings from instructional meeting blocks', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ crn: '123', days: ['MO'], dayPattern: 'M', start: '08:00', end: '09:00', census: 20, actual: 25, cap: 30 }),
    section({ crn: '123', days: ['MO'], dayPattern: 'M', start: '08:00', end: '09:00', census: 20, actual: 25, cap: 30 }),
    section({ crn: '123', days: ['MO'], dayPattern: 'M', start: '09:00', end: '10:00', census: 20, actual: 25, cap: 30 }),
    section({ crn: '123', days: ['WE'], dayPattern: 'W', start: '08:00', end: '09:00', census: 20, actual: 25, cap: 30 })
  ];
  const report = COSEnrollmentDashboard.studentPresenceReport(rows, 'all');

  assert.equal(report.metrics.totalSections, 1);
  assert.equal(report.metrics.distinctCrns, 1);
  assert.equal(report.rows[0].instructionalMeetings, 3);
  assert.equal(report.rows[0].sectionsActive, 3);
  assert.equal(report.rows[0].studentsPresent, 60);
});

test('meeting frequency factor recognizes full-term, partial-term, meeting-count, and unknown sources', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const fullTerm = section({
    days: ['MO'],
    startDate: '2026-08-17',
    endDate: '2026-12-18',
    raw: { 'Term Start': '2026-08-17', 'Term End': '2026-12-18' }
  });
  const halfTerm = section({
    days: ['MO'],
    startDate: '2026-08-17',
    endDate: '2026-10-18',
    raw: { 'Term Start': '2026-08-17', 'Term End': '2026-12-18' }
  });
  const fourMeetings = section({
    modality: 'HYBRID',
    days: ['MO'],
    raw: { 'Meeting Count': '4' }
  });
  const unknown = section({ days: ['MO'], startDate: '', endDate: '', raw: {} });

  assert.equal(COSEnrollmentDashboard.meetingFrequencyFactor(fullTerm, { sourceRows: [fullTerm] }).factor, 1);
  assert.ok(Math.abs(COSEnrollmentDashboard.meetingFrequencyFactor(halfTerm, { sourceRows: [halfTerm] }).factor - 0.5) < 0.03);
  assert.ok(Math.abs(COSEnrollmentDashboard.meetingFrequencyFactor(fourMeetings, { fullTermWeeks: 17.5 }).factor - 0.23) < 0.02);
  const missing = COSEnrollmentDashboard.meetingFrequencyFactor(unknown, { sourceRows: [unknown] });
  assert.equal(missing.factor, 1);
  assert.match(missing.warning, /Frequency unknown/);
});

test('student presence supports nominal and expected physical presence modes', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({
      crn: '90001',
      days: ['MO'],
      dayPattern: 'M',
      start: '09:00',
      end: '10:00',
      census: 20,
      actual: 25,
      cap: 30,
      startDate: '2026-08-17',
      endDate: '2026-10-18',
      raw: { 'Term Start': '2026-08-17', 'Term End': '2026-12-18' }
    })
  ];

  const nominal = COSEnrollmentDashboard.studentPresenceReport(rows, 'all', { presenceMode: 'nominal' });
  const expected = COSEnrollmentDashboard.studentPresenceReport(rows, 'all', { presenceMode: 'expected' });

  assert.equal(nominal.metrics.presenceMode, 'nominal');
  assert.equal(expected.metrics.presenceMode, 'expected');
  assert.equal(nominal.metrics.totalStudents, 20);
  assert.ok(Math.abs(expected.metrics.totalStudents - 10) < 1);
  assert.equal(nominal.metrics.totalNominalStudents, 20);
  assert.ok(Math.abs(nominal.metrics.totalExpectedStudents - expected.metrics.totalExpectedStudents) < 0.01);
  assert.ok(expected.metrics.averageMeetingFrequencyFactor < 0.53);
});

test('student presence graph series can apply expected physical presence multipliers', () => {
  const { sectionModel } = loadCoreModules();
  const rows = [
    { Term: 'FALL 2026', CRN: '555', Subject: 'BIOL', Course: '001', DAYS: 'M', 'Start Time': '8:00 AM', 'End Time': '9:00 AM', CENSUS_ENROLL: '20', 'Instructional Method': 'IP' }
  ];

  const nominal = sectionModel.buildHalfHourPresenceSeries(rows, [8, 8.5], { metric: 'presence' });
  const expected = sectionModel.buildHalfHourPresenceSeries(rows, [8, 8.5], { metric: 'presence', presenceMultiplier: () => 0.5 });

  assert.equal(nominal['Monday-8'], 20);
  assert.equal(expected['Monday-8'], 10);
  assert.equal(expected['Monday-8.5'], 10);
});

test('student presence graph series accepts already-normalized enrollment rows', () => {
  const { sectionModel } = loadCoreModules();
  const rows = [
    {
      term: 'FALL 2026',
      crn: '20001',
      subject: 'COMM',
      course: 'C1000',
      campus: 'COS',
      modality: 'IN PERSON',
      days: ['MO', 'WE'],
      start: '10:10',
      end: '11:25',
      census: 32,
      actual: 35,
      cap: 40,
      building: 'TCC',
      roomOnly: '101'
    }
  ];

  const presence = sectionModel.buildHalfHourPresenceSeries(rows, [10, 10.5, 11], { metric: 'presence' });

  assert.equal(presence['Monday-10'], 32);
  assert.equal(presence['Monday-10.5'], 32);
  assert.equal(presence['Monday-11'], 32);
  assert.equal(presence['Wednesday-10.5'], 32);
});

test('tutoring open lab rows are centrally identified', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();

  ['MATH 400', 'ENGL 400', 'LA 425'].forEach(course => {
    const [subject, number] = course.split(' ');
    const splitRow = COSEnrollmentAnalytics.normalizeRow({ Subject: subject, Course: number });
    const combinedRow = COSEnrollmentAnalytics.normalizeRow({ Course: course });
    assert.equal(COSEnrollmentAnalytics.isTutoringOpenLabSection(splitRow), true);
    assert.equal(COSEnrollmentAnalytics.isTutoringOpenLabSection(combinedRow), true);
    assert.equal(splitRow.isTutoringOpenLab, true);
  });

  assert.equal(COSEnrollmentAnalytics.isTutoringOpenLabSection(section({ subject: 'MATH', course: '021' })), false);
});

test('negative Census 2 normalizes as invalid missing data', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    CRN: '12345',
    Subject: 'MATH',
    Course: '400',
    CENSUS_ENROLL: '10',
    CENSUS_ENROLL2: '-3',
    ACTUAL_ENROLL: '8'
  });

  assert.equal(row.census2, null);
  assert.equal(row.invalidNegativeCensus2, true);
});

test('snapshot coverage excludes omitted tutoring open lab sections after filtering', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const standard = COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2026', CRN: 'S1', Subject: 'HIST', Course: '018' });
  const tutoring = COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2026', CRN: 'T1', Subject: 'MATH', Course: '400' });
  const includedRows = [standard, tutoring].filter(row => !COSEnrollmentAnalytics.isTutoringOpenLabSection(row));
  const coverage = COSEnrollmentAnalytics.snapshotCoverage(includedRows, [], 'FALL 2026');

  assert.equal(coverage.sectionsInFocusTerm, 1);
  assert.equal(coverage.sectionsMissingFirstDaySnapshot, 1);
});

test('work experience rows normalize as supplemental enrollment source', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const directFtes = COSEnrollmentAnalytics.normalizeRow({
    __sourceType: 'WORK_EXPERIENCE',
    Term: 'SPRING 2027',
    Subject: 'WKEX',
    Course: '101',
    Section: '001',
    'Current Enrollment': '12',
    FTES: '1.8',
    'ACCOUNTING METHOD': 'I'
  });
  const missingFtes = COSEnrollmentAnalytics.normalizeRow({
    __sourceType: 'WORK_EXPERIENCE',
    Term: 'SPRING 2027',
    Subject: 'WKEX',
    Course: '102',
    Section: '002',
    'Current Enrollment': '8',
    'ACCOUNTING METHOD': 'I'
  });

  assert.equal(directFtes.isWorkExperience, true);
  assert.equal(directFtes.sourceType, 'WORK EXPERIENCE');
  assert.equal(directFtes.modality, 'WORK EXPERIENCE');
  assert.equal(directFtes.days.length, 0);
  assert.equal(directFtes.timeBlock, 'WORK EXPERIENCE');
  assert.equal(directFtes.accountingReportable, true);
  assert.equal(directFtes.ftes, 1.8);
  assert.equal(missingFtes.ftesUnavailable, true);
  assert.match(missingFtes.ftesWarning, /FTES unavailable/);
});

test('campus normalization does not use building or location as campus', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    CRN: '12345',
    Subject: 'ART',
    Course: '001',
    Building: 'HACVEB',
    Room: '101',
    Location: 'HACVEB',
    Capacity: '30'
  });

  assert.equal(row.campus, '');
  assert.equal(row.building, 'HACVEB');
  assert.equal(row.room, 'HACVEB 101');
});

test('campus normalization keeps explicit campus fields separate from building', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    Subject: 'ART',
    Course: '001',
    Campus: 'Tulare',
    Building: 'TCC',
    Room: '101'
  });

  assert.equal(row.campus, 'TUL');
  assert.equal(row.building, 'TCC');
});

test('snapshot manager appends partial first-day uploads without deleting prior records', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const firstBatch = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', Section: '001', ACTUAL_ENROLL: '22' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16', uploadedAt: '2027-08-16T12:00:00Z' });
  const secondBatch = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10002', Subject: 'MATH', Course: '021', Section: '002', ACTUAL_ENROLL: '18' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-17', uploadedAt: '2027-08-17T12:00:00Z' });

  const firstSave = COSEnrollmentAnalytics.upsertSnapshotRecords([], firstBatch);
  const secondSave = COSEnrollmentAnalytics.upsertSnapshotRecords(firstSave.records, secondBatch);

  assert.equal(firstSave.appended, 1);
  assert.equal(secondSave.appended, 1);
  assert.equal(secondSave.updated, 0);
  assert.equal(secondSave.records.length, 2);
  assert.equal(secondSave.records.map(record => record.crn).sort().join(','), '10001,10002');
});

test('snapshot manager updates same term CRN type instead of duplicating', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const first = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '22' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16' });
  const updated = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '24' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-18' });

  const saved = COSEnrollmentAnalytics.upsertSnapshotRecords(first, updated);

  assert.equal(saved.appended, 0);
  assert.equal(saved.updated, 1);
  assert.equal(saved.records.length, 1);
  assert.equal(saved.records[0].enrollment, 24);
  assert.equal(saved.records[0].snapshotDate, '2027-08-18');
});

test('stored first-day snapshots merge into lifecycle rows by term and CRN', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2027', CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '20', CENSUS_ENROLL: '25' })
  ];
  const snapshots = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '12' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16' });

  const merged = COSEnrollmentAnalytics.mergeSnapshotsIntoRows(rows, snapshots);

  assert.equal(snapshots[0].sourceFieldUsed, 'ACTUAL_ENROLL');
  assert.equal(merged[0].firstDay, 12);
  assert.match(merged[0].firstDaySource, /Stored FIRST DAY snapshot/);
});

test('snapshot coverage counts missing first-day sections', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2027', CRN: '10001', Subject: 'ENGL', Course: 'C1000' }),
    COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2027', CRN: '10002', Subject: 'MATH', Course: '021' })
  ];
  const snapshots = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '12' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16' });

  const coverage = COSEnrollmentAnalytics.snapshotCoverage(rows, snapshots, 'FALL 2027');

  assert.equal(coverage.sectionsInFocusTerm, 2);
  assert.equal(coverage.sectionsWithFirstDaySnapshot, 1);
  assert.equal(coverage.sectionsMissingFirstDaySnapshot, 1);
  assert.equal(coverage.firstDayCoveragePct, 0.5);
});

test('snapshot coverage counts all decision sections missing first-day snapshots', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2027', crn: 'A1' }),
    section({ term: 'SPRING 2027', crn: 'A2' }),
    section({ term: 'SPRING 2026', crn: 'H1' })
  ];

  const coverage = COSEnrollmentAnalytics.snapshotCoverage(rows, [], 'Spring 2027');

  assert.equal(coverage.sectionsInFocusTerm, 2);
  assert.equal(coverage.sectionsWithFirstDaySnapshot, 0);
  assert.equal(coverage.sectionsMissingFirstDaySnapshot, 2);
  assert.equal(coverage.firstDayCoveragePct, 0);
});

test('future lifecycle milestone fields normalize when present', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    Subject: 'PS',
    Course: '200M',
    'First Day Enrollment': '31',
    Census_1: '28',
    CENSUS_2: '26',
    FINAL_ENROLLMENT: '22',
    ACTUAL_ENROLL: '20',
    CENSUS_ENROLL: '25'
  });

  assert.equal(row.firstDay, 31);
  assert.equal(row.census1, 28);
  assert.equal(row.census2, 26);
  assert.equal(row.finalEnrollment, 22);
  assert.equal(row.actual, 20);
  assert.equal(row.census, 25);
});

test('attrition lifecycle calculations use census 2 and matched first-day rows', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('PS 200M');
  const rows = [
    section({ crn: 'L1', firstDay: 30, census1: 28, census2: 25, finalEnrollment: 20 }),
    section({ crn: 'L2', firstDay: null, census1: 22, census2: 20, finalEnrollment: 18 })
  ];
  rows.forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));

  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionStartToEndMatchedCrns, 1);
  assert.equal(metrics.decisionStartToEndAttritionCount, 10);
  assert.equal(Math.round(metrics.decisionStartToEndAttritionRate * 1000) / 1000, 0.333);
  assert.equal(metrics.decisionCensus1ToCensus2AttritionCount, 5);
  assert.equal(Math.round(metrics.decisionCensus1ToCensus2AttritionRate * 1000) / 1000, 0.1);
  assert.equal(metrics.decisionCensus2ToEndAttritionCount, 7);
});

test('attrition lifecycle first-day metrics are unavailable when no first-day snapshots exist', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('PS 200M');
  [
    section({ crn: 'N1', firstDay: null, census1: 28, census2: 30, finalEnrollment: 32 }),
    section({ crn: 'N2', firstDay: null, census1: 22, census2: 20, finalEnrollment: 18 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));

  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionStartToEndMatchedCrns, 0);
  assert.equal(metrics.decisionStartToEndAttritionRate, null);
  assert.equal(COSEnrollmentAnalytics.lifecycleMetricLabel(metrics.decisionStartToEndAttritionRate), 'N/A');
  assert.equal(metrics.decisionCensus2ToEndMatchedCrns, 2);
  assert.equal(metrics.decisionCensus2ToEndAttritionCount, 0);
});

test('attrition lifecycle start-based calculations work when first-day coverage is complete', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('PS 200M');
  [
    section({ crn: 'S1', firstDay: 30, census1: 28, census2: 26, finalEnrollment: 22 }),
    section({ crn: 'S2', firstDay: 20, census1: 18, census2: 16, finalEnrollment: 12 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));

  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionStartToEndAttritionCount, 16);
  assert.equal(metrics.decisionStartToCensus1AttritionCount, 4);
  assert.equal(metrics.decisionStartToCensus2AttritionCount, 8);
  assert.equal(metrics.decisionCensus1ToEndAttritionCount, 12);
});

test('attrition lifecycle reports enrollment growth as negative attrition', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('Overall');
  [
    section({ crn: 'G1', census1: 10, census2: 12, finalEnrollment: 15 }),
    section({ crn: 'G2', census1: 24, census2: 22, finalEnrollment: 25 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));
  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionCensus2ToEndAttritionCount, -6);
  assert.equal(Math.round(metrics.decisionCensus2ToEndAttritionRate * 10000) / 10000, -0.1765);
  assert.equal(COSEnrollmentAnalytics.lifecycleMetricLabel(metrics.decisionCensus2ToEndAttritionRate), '-17.6%');
});

test('attrition lifecycle uses matched CRNs when milestone populations differ', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('Overall');
  [
    section({ crn: 'A1', census1: 10, census2: null }),
    section({ crn: 'A2', census1: 20, census2: 18 }),
    section({ crn: 'A3', census: null, census1: null, census2: 15 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));
  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 3);

  assert.equal(metrics.decisionCensus1ToCensus2MatchedCrns, 1);
  assert.equal(metrics.decisionCensus1ToCensus2AttritionCount, 2);
  assert.equal(metrics.decisionCensus1ToCensus2AttritionRate, 0.1);
  assert.equal(metrics.decisionMilestonePopulationMismatch, true);
  assert.equal(metrics.decisionMilestoneCrnCounts.firstDay, 0);
  assert.equal(metrics.decisionMilestoneCrnCounts.census1, 2);
  assert.equal(metrics.decisionMilestoneCrnCounts.census2, 2);
  assert.equal(metrics.decisionMilestoneCrnCounts.final, 3);
});

test('lifecycle diagnostics presentation keeps mismatch warnings out of headline cards', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const detailStart = text.indexOf("table('attritionTable'");
  const detailEnd = text.indexOf('renderAttritionLegend', detailStart);
  const detailBlock = text.slice(detailStart, detailEnd);

  assert.match(text, /Enrollment Attrition Trend/);
  assert.match(text, /Diagnostic Attrition Rates/);
  assert.match(text, /Planning Term Excluded/);
  assert.match(text, /Attrition Executive Summary/);
  assert.match(text, /Data Quality & Coverage/);
  assert.doesNotMatch(text, /attrIncludeHistory/);
  assert.doesNotMatch(text.slice(text.indexOf('renderAttritionSummarySections'), text.indexOf('renderAttritionDiagnosticRates')), /N\/A - Different section populations/);
  [
    'courseGroup',
    'historicalTermsUsed',
    'historicalSectionsCrns',
    'census1Enrollment',
    'census2Enrollment',
    'endFinalEnrollment',
    'census1ToCensus2AttritionDisplay',
    'census2ToFinalAttritionDisplay',
    'census1ToFinalAttritionDisplay',
    'trendInterpretation',
    'confidence'
  ].forEach(column => assert.match(detailBlock, new RegExp(column)));
  assert.match(text, /firstDayToCensus1Attrition/);
  assert.match(text, /census2ToEndFinalAttrition/);
});

test('dashboard focus term scopes current metrics and excludes focus from history', () => {
  const { COSEnrollmentAnalytics, COSEnrollmentDashboard } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2025', subject: 'BUS', course: '050', crn: '1', census: 80, actual: 75, cap: 100, ftes: 8 }),
    section({ term: 'SPRING 2026', subject: 'BUS', course: '050', crn: '2', census: 100, actual: 95, cap: 100, ftes: 10 }),
    section({ term: 'FALL 2026', subject: 'BUS', course: '050', crn: '4', census: 999, actual: 999, cap: 1000, ftes: 99 }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '3', census: 0, actual: 0, cap: 100, ftes: 0 })
  ];

  const currentRows = COSEnrollmentAnalytics.dashboardCurrentRows(rows, 'SPRING 2027');
  const historicalRows = COSEnrollmentAnalytics.dashboardHistoricalRows(rows, 'SPRING 2027');
  const summary = COSEnrollmentDashboard.dashboardSummary(currentRows, historicalRows, []);

  assert.deepEqual(Array.from(COSEnrollmentAnalytics.dashboardAvailableTerms(rows)), ['SPRING 2025', 'SPRING 2026', 'FALL 2026', 'SPRING 2027']);
  assert.equal(summary.health.currentEnrollment, 0);
  assert.equal(summary.health.sectionsReviewed, 1);
  assert.equal(summary.health.coursesReviewed, 1);
  assert.equal(summary.health.ftes, 0);
  assert.equal(summary.health.expectedEnrollment, 90);
  const campusPace = summary.pace.find(row => row.dimension === 'Campus' && row.name === 'VIS');
  assert.equal(campusPace.currentEnrollment, 0);
  assert.equal(campusPace.expectedEnrollment, 90);
  assert.equal(campusPace.variance, -90);
  assert.equal(campusPace.variancePct, -1);
  assert.equal(campusPace.status, 'Behind Pace');
  assert.equal(historicalRows.some(row => row.term === 'SPRING 2027'), false);
  assert.equal(historicalRows.some(row => row.term === 'FALL 2026'), false);
});

test('dashboard expected enrollment is N/A without comparable same-season history', () => {
  const { COSEnrollmentAnalytics, COSEnrollmentDashboard } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2026', subject: 'BUS', course: '050', crn: '1', census: 999, actual: 999, cap: 1000 }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '2', census: 12, actual: 12, cap: 30 })
  ];

  const currentRows = COSEnrollmentAnalytics.dashboardCurrentRows(rows, 'SPRING 2027');
  const historicalRows = COSEnrollmentAnalytics.dashboardHistoricalRows(rows, 'SPRING 2027');
  const summary = COSEnrollmentDashboard.dashboardSummary(currentRows, historicalRows, []);
  const campusPace = summary.pace.find(row => row.dimension === 'Campus' && row.name === 'VIS');

  assert.equal(historicalRows.length, 0);
  assert.equal(summary.health.expectedEnrollment, null);
  assert.equal(campusPace.expectedEnrollment, null);
  assert.equal(campusPace.variance, null);
  assert.equal(campusPace.variancePct, null);
  assert.equal(campusPace.status, 'N/A');
});

test('registration pace separates scheduled time blocks from asynchronous and TBA rows', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2027', crn: 'S1', modality: 'IN PERSON', campus: 'VIS', division: 'Arts', days: ['MO'], dayPattern: 'M', start: '09:00', end: '10:00', timeBlock: '09:00-09:59', census: 20, ftes: 2 }),
    section({ term: 'FALL 2027', crn: 'O1', modality: 'ONLINE', campus: 'ONLINE', division: 'Arts', days: ['MO'], dayPattern: 'M', start: '00:00', end: '19:00', timeBlock: '00:00-00:59', census: 30, ftes: 3 }),
    section({ term: 'FALL 2027', crn: 'T1', modality: 'TBA', campus: 'VIS', division: 'Arts', days: [], dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 10, ftes: 1 }),
    section({ term: 'FALL 2027', crn: 'U1', modality: 'IN PERSON', campus: 'VIS', division: 'Arts', days: [], dayPattern: 'M', start: '', end: '', timeBlock: '', census: 5, ftes: 0.5 })
  ];
  const historicalRows = [
    section({ term: 'FALL 2026', crn: 'HS1', modality: 'IN PERSON', campus: 'VIS', division: 'Arts', days: ['MO'], dayPattern: 'M', start: '09:00', end: '10:00', timeBlock: '09:00-09:59', census: 15, ftes: 1.5 }),
    section({ term: 'FALL 2026', crn: 'HO1', modality: 'ONLINE', campus: 'ONLINE', division: 'Arts', days: ['MO'], dayPattern: 'M', start: '00:00', end: '19:00', timeBlock: '00:00-00:59', census: 25, ftes: 2.5 }),
    section({ term: 'FALL 2026', crn: 'HT1', modality: 'TBA', campus: 'VIS', division: 'Arts', days: [], dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 8, ftes: 0.8 }),
    section({ term: 'FALL 2026', crn: 'HU1', modality: 'IN PERSON', campus: 'VIS', division: 'Arts', days: [], dayPattern: 'M', start: '', end: '', timeBlock: '', census: 4, ftes: 0.4 })
  ];
  const summary = COSEnrollmentDashboard.dashboardSummary(rows, historicalRows, []);
  const timeRows = summary.pace.filter(row => row.dimension === 'Time Block');
  const asyncRows = summary.pace.filter(row => row.dimension === 'Asynchronous/TBA');

  assert.equal(JSON.stringify(timeRows.map(row => row.name)), JSON.stringify(['09:00-09:59']));
  assert.equal(timeRows.some(row => row.name === '00:00-00:59' || row.name === 'ONLINE/TBA'), false);
  assert.equal(asyncRows.find(row => row.name === 'Online (Asynchronous)').currentEnrollment, 30);
  assert.equal(asyncRows.find(row => row.name === 'TBA').currentEnrollment, 10);
  assert.equal(asyncRows.find(row => row.name === 'Unknown Meeting Time').currentEnrollment, 5);
  assert.equal(timeRows.reduce((total, row) => total + row.currentEnrollment, 0) + asyncRows.reduce((total, row) => total + row.currentEnrollment, 0), summary.health.currentEnrollment);
  assert.equal(summary.pace.find(row => row.dimension === 'Campus' && row.name === 'VIS').currentEnrollment, 35);
  assert.equal(summary.pace.find(row => row.dimension === 'Time Block' && row.name === '09:00-09:59').status, 'Ahead of Pace');
  assert.equal(Number(summary.pace.find(row => row.dimension === 'Time Block' && row.name === '09:00-09:59').estimatedFtesImpact.toFixed(1)), 0.5);
});

test('dashboard all loaded terms is explicit gross-total mode', () => {
  const { COSEnrollmentAnalytics, COSEnrollmentDashboard } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2025', subject: 'BUS', course: '050', crn: '1', census: 80, actual: 75, cap: 100 }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '2', census: 10, actual: 10, cap: 100 })
  ];

  const allRows = COSEnrollmentAnalytics.dashboardCurrentRows(rows, '');
  const summary = COSEnrollmentDashboard.dashboardSummary(allRows, [], []);

  assert.equal(summary.health.currentEnrollment, 90);
  assert.equal(summary.health.sectionsReviewed, 2);
});

test('dashboard scope panel warns on all loaded terms and multiple current terms', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2025', subject: 'BUS', course: '050', crn: '1' }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '2' })
  ];
  const context = COSEnrollmentAnalytics.dashboardScopeContext(rows, rows, '');

  assert.equal(context.focusLabel, 'All Loaded Terms');
  assert.equal(context.currentRowsCount, 2);
  assert.deepEqual(Array.from(context.currentTerms), ['SPRING 2025', 'SPRING 2027']);
  assert.ok(context.warnings.includes('All Loaded Terms shows gross totals and should not be used as a decision-term dashboard.'));
  assert.ok(context.warnings.includes('No focus term selected. Select a decision/focus term for decision-term metrics.'));
  assert.ok(context.warnings.includes('Current rows include multiple terms. Confirm All Loaded Terms was selected intentionally.'));
});

test('dashboard scope panel warns when comparable history is unavailable', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const currentRows = [section({ term: 'SPRING 2027', subject: 'BUS', course: '050' })];
  const context = COSEnrollmentAnalytics.dashboardScopeContext(currentRows, [], 'SPRING 2027');

  assert.equal(context.focusTerm, 'SPRING 2027');
  assert.equal(context.historicalRowsCount, 0);
  assert.deepEqual(Array.from(context.historicalTerms), []);
  assert.ok(context.warnings.includes('Expected enrollment has no historical comparison terms for the selected focus term.'));
});

test('dashboard scope panel reports lifecycle milestone availability', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const missingContext = COSEnrollmentAnalytics.dashboardScopeContext([
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050' })
  ], [], 'SPRING 2027');
  const available = COSEnrollmentAnalytics.summaryLifecycleAvailability([
    section({ firstDay: 10, census1: 9, census2: 8, finalEnrollment: 7 })
  ]);

  assert.deepEqual(Array.from(missingContext.missingMilestones), ['First Day', 'Census 1', 'Census 2', 'Final']);
  assert.ok(missingContext.warnings.includes('Lifecycle milestone data unavailable in current upload.'));
  assert.deepEqual(Array.from(available.missing), []);
});

test('grouped consolidation returns one opportunity for reciprocal section matches', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const sections = [
    section({ crn: '20359', census: 10, actual: 8, expectedEnrollment: 10, cap: 30, expectedFillRate: 10 / 30 }),
    section({ crn: '20358', census: 19, actual: 17, expectedEnrollment: 19, cap: 30, expectedFillRate: 19 / 30 }),
    section({ crn: '20360', census: 19, actual: 18, expectedEnrollment: 19, cap: 30, expectedFillRate: 19 / 30 })
  ];
  const history = new Map([[COSConsolidationAnalytics.patternKey(sections[0]), { terms: 4, low: 3 }]]);

  const rows = COSConsolidationAnalytics.consolidationGroupRows('PS 200M', sections, history, 0.5, null, {
    sameCampus: true,
    sameModality: true,
    dayMatch: 'exact',
    timeWindowHours: 0,
    absorbPct: 0.6,
    chronicThreshold: 0.75,
    minHist: 3
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'In-Person Consolidation');
  assert.equal(rows[0].sectionsReviewed, 3);
  assert.equal(rows[0].potentialSectionsRemoved, 1);
  assert.equal(rows[0].expectedEnrollment, 48);
  assert.equal(rows[0].availableReceivingCapacity, 22);
  assert.equal(rows[0].netAvailableCapacity, 16);
  assert.equal(rows[0].finalEnrollmentContext, '8');
});

test('limited consolidation history is not labeled high confidence', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const sections = [
    section({ crn: '41001', census: 8, actual: 8, expectedEnrollment: 8, cap: 30, expectedFillRate: 8 / 30 }),
    section({ crn: '41002', census: 20, actual: 20, expectedEnrollment: 20, cap: 30, expectedFillRate: 20 / 30 }),
    section({ crn: '41003', census: 20, actual: 20, expectedEnrollment: 20, cap: 30, expectedFillRate: 20 / 30 })
  ];
  const history = new Map([[COSConsolidationAnalytics.patternKey(sections[0]), { terms: 1, low: 1 }]]);

  const rows = COSConsolidationAnalytics.consolidationGroupRows('PS 200M', sections, history, 0.5, null, {
    sameCampus: true,
    sameModality: true,
    dayMatch: 'exact',
    timeWindowHours: 0,
    absorbPct: 0.6,
    chronicThreshold: 0.75,
    minHist: 3
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].historicalTerms, 1);
  assert.equal(rows[0].label, 'Limited History Review');
  assert.equal(rows[0].confidenceLevel, 'Limited History');
});

test('TBA consolidation confidence is capped', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const sections = [
    section({ crn: '30001', dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 5, expectedEnrollment: 5, cap: 30, expectedFillRate: 5 / 30 }),
    section({ crn: '30002', dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 10, expectedEnrollment: 10, cap: 30, expectedFillRate: 10 / 30 })
  ];
  const rows = COSConsolidationAnalytics.consolidationGroupRows('ART 101', sections, new Map(), 0.5, null, {
    sameCampus: true,
    sameModality: true,
    dayMatch: 'exact',
    timeWindowHours: 0,
    absorbPct: 0.6,
    chronicThreshold: 0.75,
    minHist: 3
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tba, true);
  assert.ok(rows[0].score <= 70);
});

test('online reduction candidates stay course-level and census-based', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const decision = [
    section({ term: 'FALL 2026', subject: 'STAT', course: '321', modality: 'ONLINE', crn: '40001', cap: 35 }),
    section({ term: 'FALL 2026', subject: 'STAT', course: '321', modality: 'ONLINE', crn: '40002', cap: 35 }),
    section({ term: 'FALL 2026', subject: 'STAT', course: '321', modality: 'ONLINE', crn: '40003', cap: 35 })
  ];
  const historical = [
    section({ term: 'FALL 2025', subject: 'STAT', course: '321', modality: 'ONLINE', census: 20, actual: 12, cap: 35 }),
    section({ term: 'FALL 2024', subject: 'STAT', course: '321', modality: 'ONLINE', census: 25, actual: 11, cap: 35 })
  ];

  const rows = COSConsolidationAnalytics.onlineReductionRows(decision, historical, { vacancyBasis: 'census' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'Online Reduction');
  assert.equal(rows[0].sectionsReviewed, 3);
  assert.equal(rows[0].expectedEnrollment, 23);
  assert.match(rows[0].projectionSource, /Historical Average \(2 terms\)/);
});

test('online reductions require decision-term expected vacancy', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const decision = [
    section({ term: 'FALL 2026', subject: 'HIST', course: '018', modality: 'ONLINE', crn: '50001', cap: 25 }),
    section({ term: 'FALL 2026', subject: 'HIST', course: '018', modality: 'ONLINE', crn: '50002', cap: 25 })
  ];
  const historical = [
    section({ term: 'FALL 2025', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H1', census: 30, cap: 50 }),
    section({ term: 'FALL 2025', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H2', census: 30, cap: 50 }),
    section({ term: 'FALL 2024', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H3', census: 30, cap: 50 }),
    section({ term: 'FALL 2024', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H4', census: 30, cap: 50 })
  ];

  const rows = COSConsolidationAnalytics.onlineReductionRows(decision, historical, { vacancyBasis: 'census' });

  assert.equal(rows.length, 0);
});

test('consolidation crosswalk maps old English history into ENGL C1000 online demand', () => {
  const runtime = loadEnrollmentAnalyticsRuntime();
  const { COSConsolidationAnalytics, COSEnrollmentAnalytics } = runtime;
  runtime.CURRICULUM_CROSSWALK = [
    { sourceCourse: 'ENGL 001', synonymCourse: 'ENGL C1000' }
  ];
  const decision = COSEnrollmentAnalytics.applyCurriculumCrosswalkToRows([
    section({ term: 'FALL 2026', subject: 'ENGL', course: 'C1000', modality: 'ONLINE', crn: 'D1', cap: 25 }),
    section({ term: 'FALL 2026', subject: 'ENGL', course: 'C1000', modality: 'ONLINE', crn: 'D2', cap: 25 }),
    section({ term: 'FALL 2026', subject: 'ENGL', course: 'C1000', modality: 'ONLINE', crn: 'D2', cap: 25 })
  ]);
  const historical = COSEnrollmentAnalytics.applyCurriculumCrosswalkToRows([
    section({ term: 'FALL 2025', subject: 'ENGL', course: '001', modality: 'ONLINE', crn: 'H1', census: 20, cap: 25 }),
    section({ term: 'FALL 2024', subject: 'ENGL', course: '001', modality: 'ONLINE', crn: 'H2', census: 18, cap: 25 })
  ]);

  const rows = COSConsolidationAnalytics.onlineReductionRows(decision, historical, { vacancyBasis: 'census' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].course, 'ENGL C1000');
  assert.equal(rows[0].sectionsReviewed, 2);
  assert.equal(rows[0].expectedEnrollment, 19);
  assert.equal(rows[0].historicalAverageEnrollment, 19);
});

test('division filter changes consolidation row count and exported rows', () => {
  const { COSConsolidationAnalytics, COSEnrollmentFilters } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', crn: 'A1', expectedEnrollment: 10, census: 10, cap: 30, expectedFillRate: 10 / 30 }),
    section({ division: 'Arts', crn: 'A2', expectedEnrollment: 19, census: 19, cap: 30, expectedFillRate: 19 / 30 }),
    section({ division: 'Business', crn: 'B1', subject: 'BUS', course: '101', expectedEnrollment: 10, census: 10, cap: 30, expectedFillRate: 10 / 30 }),
    section({ division: 'Business', crn: 'B2', subject: 'BUS', course: '101', expectedEnrollment: 19, census: 19, cap: 30, expectedFillRate: 19 / 30 })
  ];
  const filtered = COSEnrollmentFilters.filterRowsByDivision(rows, ['Arts']);
  const opportunities = COSConsolidationAnalytics.consolidationGroupRows('PS 200M', filtered, new Map(), 0.5, null, {
    sameCampus: true,
    sameModality: true,
    dayMatch: 'exact',
    timeWindowHours: 0,
    absorbPct: 0.6
  });
  const exportedRows = opportunities.map(row => ({ course: row.course, division: filtered[0].division }));

  assert.equal(filtered.length, 2);
  assert.equal(opportunities.length, 1);
  assert.equal(exportedRows.length, 1);
  assert.equal(exportedRows[0].division, 'Arts');
});

test('division filter changes attrition row count and exported rows', () => {
  const { COSEnrollmentFilters, COSEnrollmentMetrics } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', subject: 'ART', course: '101', census: 20, actual: 15, cap: 30 }),
    section({ division: 'Business', subject: 'BUS', course: '101', census: 25, actual: 20, cap: 30 })
  ];
  const filtered = COSEnrollmentFilters.filterRowsByDivision(rows, ['Arts']);
  const exportedRows = filtered.map(row => ({
    course: `${row.subject} ${row.course}`,
    division: row.division,
    census: COSEnrollmentMetrics.censusEnrollment(row),
    final: COSEnrollmentMetrics.finalEnrollment(row),
    attritionCount: Math.max(0, COSEnrollmentMetrics.censusEnrollment(row) - COSEnrollmentMetrics.finalEnrollment(row))
  }));

  assert.equal(filtered.length, 1);
  assert.equal(exportedRows.length, 1);
  assert.equal(exportedRows[0].division, 'Arts');
  assert.equal(exportedRows[0].attritionCount, 5);
});

test('dashboard summary loads decision-support sections', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', census: 20, actual: 18, cap: 25, waitlist: 4 }),
    section({ division: 'Arts', subject: 'ART', course: '102', census: 15, actual: 14, cap: 20, waitlist: 0 })
  ];
  const historical = [
    section({ term: 'FALL 2025', division: 'Arts', census: 18, actual: 17, cap: 25 }),
    section({ term: 'FALL 2024', division: 'Arts', census: 16, actual: 15, cap: 25 })
  ];

  const summary = COSEnrollmentDashboard.dashboardSummary(rows, historical, [{ course: 'PS 200M', type: 'In-Person Consolidation' }]);

  assert.equal(summary.health.currentEnrollment, 35);
  assert.ok(summary.pace.length > 0);
  assert.ok(summary.growth.length > 0);
  assert.equal(summary.reduction.length, 1);
  assert.ok(summary.rotation.length > 0);
});

test('dashboard lifecycle displays N/A when milestone fields are missing', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([
    section({ census: 24, actual: 18 }),
    section({ census: 20, actual: 15 })
  ], [], []);

  assert.deepEqual(Array.from(summary.health.lifecycle.map(item => item.value)), [null, null, null, null]);
  const exportRows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, {});
  const lifecycleRows = exportRows.filter(row => row.Section === 'Enrollment Health' && row.Group === 'Lifecycle Milestone');
  assert.equal(lifecycleRows.every(row => row.Value === 'N/A'), true);
});

test('dashboard lifecycle totals future milestone fields when available', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([
    section({ firstDay: 30, census1: 28, census2: 26, finalEnrollment: 22 }),
    section({ firstDay: 20, census1: 18, census2: 16, finalEnrollment: 12 })
  ], [], []);

  assert.deepEqual(Array.from(summary.health.lifecycle.map(item => item.value)), [50, 46, 42, 34]);
});

test('dashboard division filter changes row count and exported rows', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', subject: 'ART', course: '101' }),
    section({ division: 'Business', subject: 'BUS', course: '101' })
  ];

  const filtered = COSEnrollmentDashboard.applyDashboardFilters(rows, { division: ['Arts'] });
  const exportedRows = COSEnrollmentDashboard.rotationRows(filtered);

  assert.equal(filtered.length, 1);
  assert.equal(exportedRows.length, 1);
  assert.equal(exportedRows[0].division, 'Arts');
});

test('growth opportunities use existing viable seats before recommending capacity', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ subject: 'ART', course: '110', crn: 'A1', waitlist: 8, census: 30, cap: 30, modality: 'IN PERSON', campus: 'VIS', days: ['MO', 'WE'], start: '09:00' }),
    section({ subject: 'ART', course: '110', crn: 'A2', waitlist: 0, census: 10, cap: 25, modality: 'IN PERSON', campus: 'VIS', days: ['WE'], start: '10:00' })
  ];

  const [opportunity] = COSEnrollmentDashboard.growthOpportunities(rows);

  assert.equal(opportunity.waitlist, 8);
  assert.equal(opportunity.openSeats, 15);
  assert.equal(opportunity.viableOpenSeats, 15);
  assert.equal(opportunity.recommendation, 'Use Existing Seats First');
});

test('growth opportunities recommend review when viable seats are insufficient', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ subject: 'BUS', course: '120', crn: 'B1', waitlist: 12, census: 30, cap: 30, modality: 'IN PERSON', campus: 'VIS', days: ['MO'], start: '09:00' }),
    section({ subject: 'BUS', course: '120', crn: 'B2', waitlist: 0, census: 20, cap: 40, modality: 'IN PERSON', campus: 'TCCB', days: ['TH'], start: '18:00' })
  ];

  const [opportunity] = COSEnrollmentDashboard.growthOpportunities(rows);

  assert.equal(opportunity.openSeats, 20);
  assert.equal(opportunity.viableOpenSeats, 0);
  assert.equal(opportunity.recommendation, 'Consider Added Capacity');
});

test('growth opportunities report online, campus, and modality seat buckets', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ subject: 'STAT', course: '130', crn: 'S1', waitlist: 9, census: 30, cap: 30, modality: 'ONLINE', campus: 'ONLINE', days: [], start: '' }),
    section({ subject: 'STAT', course: '130', crn: 'S2', waitlist: 0, census: 10, cap: 20, modality: 'ONLINE', campus: 'ONLINE', days: [], start: '' }),
    section({ subject: 'STAT', course: '130', crn: 'S3', waitlist: 0, census: 12, cap: 20, modality: 'IN PERSON', campus: 'VIS', days: ['MO'], start: '09:00' })
  ];

  const [opportunity] = COSEnrollmentDashboard.growthOpportunities(rows);

  assert.equal(opportunity.onlineSeats, 10);
  assert.equal(opportunity.sameModalitySeats, 10);
  assert.equal(opportunity.sameCampusSeats, 10);
  assert.equal(opportunity.viableOpenSeats, 10);
  assert.equal(opportunity.recommendation, 'Use Existing Seats First');
});

test('student presence analytics excludes online sections', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const presence = COSEnrollmentDashboard.studentPresence([
    section({ modality: 'IN PERSON', census: 20, days: ['MO'], campus: 'VIS', start: '09:00' }),
    section({ modality: 'ONLINE', census: 99, days: ['MO'], campus: 'WEB', start: '' }),
    section({ modality: 'HYBRID', census: 50, days: ['SA'], campus: 'ONLINE', start: '00:00' }),
    section({ modality: 'IN PERSON', census: 30, days: ['TBA'], campus: 'VIS', start: '00:00' })
  ]);

  assert.equal(presence.rows.length, 3);
  assert.equal(presence.rows.reduce((sum, row) => sum + row.studentsPresent, 0), 60);
  assert.equal(presence.rows.every(row => row.campus === 'VIS'), true);
});

test('detailed student presence report excludes non-physical rows and groups room buckets', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const report = COSEnrollmentDashboard.studentPresenceReport([
    section({ crn: 'P1', modality: 'IN PERSON', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 20, cap: 30 }),
    section({ crn: 'P2', modality: 'HYBRID', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 10, cap: 20 }),
    section({ modality: 'ONLINE', campus: 'ONLINE', building: '', roomOnly: '', room: '', days: ['MO'], start: '', census: 99, cap: 100 }),
    section({ modality: 'IN PERSON', campus: 'VIS', building: 'KERN', roomOnly: '102', room: 'KERN 102', days: ['TBA'], start: '00:00', census: 50, cap: 60 })
  ], 'roomDayHour');

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].group, '101 / MO / 10:00');
  assert.equal(report.rows[0].studentsPresent, 30);
  assert.equal(report.rows[0].sectionsActive, 2);
  assert.equal(report.rows[0].seatsScheduled, 50);
  assert.equal(report.rows[0].availableRoomCapacity, 20);
  assert.equal(report.metrics.totalStudents, 30);
  assert.equal(report.metrics.peakRoom.group, '101');
});

test('student presence deduplicates duplicate meeting rows within the same bucket', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const report = COSEnrollmentDashboard.studentPresenceReport([
    section({ crn: 'DUP1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 25, cap: 30 }),
    section({ crn: 'DUP1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 25, cap: 30 })
  ], 'roomDayHour');

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].studentsPresent, 25);
  assert.equal(report.rows[0].sectionsActive, 1);
  assert.equal(report.rows[0].distinctCrns, 1);
  assert.equal(report.rows[0].meetingRowsIncluded, 2);
  assert.equal(report.metrics.totalSections, 1);
  assert.equal(report.metrics.distinctCrns, 1);
  assert.equal(report.metrics.meetingRowsIncluded, 2);
});

test('student presence counts one CRN in multiple buckets but only once overall', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const report = COSEnrollmentDashboard.studentPresenceReport([
    section({ crn: 'MULTI1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '09:00', census: 20, cap: 30 }),
    section({ crn: 'MULTI1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['WE'], start: '09:00', census: 20, cap: 30 })
  ], 'campusDayHour');

  assert.equal(report.rows.length, 6);
  assert.equal(report.rows.reduce((sum, row) => sum + row.studentsPresent, 0), 120);
  assert.equal(report.rows.every(row => row.sectionsActive === 1), true);
  assert.equal(report.metrics.totalSections, 1);
  assert.equal(report.metrics.distinctCrns, 1);
  assert.equal(report.metrics.meetingRowsIncluded, 2);
});

test('student presence defaults to physical in-person hybrid rows and supports explicit expansion', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ crn: 'IP1', modality: 'IN PERSON', campus: 'COS', days: ['MO'], start: '09:00', end: '09:30', census: 10 }),
    section({ crn: 'HY1', modality: 'HYBRID', campus: 'TCC', days: ['MO'], start: '09:00', end: '09:30', census: 20 }),
    section({ crn: 'DE1', modality: 'DUAL ENROLLMENT', campus: 'COS', days: ['MO'], start: '09:00', end: '09:30', census: 30 }),
    section({ crn: 'ON1', modality: 'ONLINE', campus: 'COS', days: ['MO'], start: '09:00', end: '09:30', census: 40 }),
    section({ crn: 'OT1', modality: 'IN PERSON', campus: 'SATELLITE', days: ['MO'], start: '09:00', end: '09:30', census: 50 })
  ];

  const defaults = COSEnrollmentDashboard.studentPresenceReport(rows, 'hour');
  assert.equal(defaults.metrics.totalStudents, 30);
  assert.equal(defaults.metrics.totalSections, 2);

  const withDualEnrollment = COSEnrollmentDashboard.studentPresenceReport(rows, 'hour', { includeDualEnrollment: true });
  assert.equal(withDualEnrollment.metrics.totalStudents, 60);
  assert.equal(withDualEnrollment.metrics.totalSections, 3);

  const expanded = COSEnrollmentDashboard.studentPresenceReport(rows, 'hour', { includeDualEnrollment: true, includeOtherModalities: true, physicalCampuses: [] });
  assert.equal(expanded.metrics.totalStudents, 150);
  assert.equal(expanded.metrics.totalSections, 5);
});

test('conflict check flags partial overlaps and deduplicates duplicate meetings', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2027', crn: 'C1', subject: 'ENGL', course: 'C1000', instructor: 'ONE, A', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO', 'WE'], dayPattern: 'MW', start: '09:00', end: '10:15' }),
    section({ term: 'FALL 2027', crn: 'C1', subject: 'ENGL', course: 'C1000', instructor: 'ONE, A', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO', 'WE'], dayPattern: 'MW', start: '09:00', end: '10:15' }),
    section({ term: 'FALL 2027', crn: 'C2', subject: 'MATH', course: '021', instructor: 'TWO, B', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], dayPattern: 'M', start: '10:00', end: '11:00' }),
    section({ term: 'FALL 2027', crn: 'C3', subject: 'HIST', course: '018', instructor: 'ONE, A', building: 'KERN', roomOnly: '102', room: 'KERN 102', days: ['MO'], start: '09:30', end: '10:30' }),
    section({ term: 'FALL 2027', crn: 'C4', subject: 'HIST', course: '018', instructor: 'THREE, C', building: 'KERN', roomOnly: '103', room: 'KERN 103', days: ['TBA'], start: '', end: '' })
  ];

  const conflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap']);

  assert.equal(conflicts.length, 2);
  assert.equal(conflicts.filter(row => row.conflictType === 'Same room overlap').length, 1);
  assert.equal(conflicts.filter(row => row.conflictType === 'Same instructor overlap').length, 1);
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').overlapMinutes, 15);
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').day, 'MO');
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').meetingDays1, 'MW');
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').meetingDays2, 'M');
  assert.equal(conflicts.find(row => row.conflictType === 'Same instructor overlap').overlapMinutes, 45);
  assert.equal(conflicts.some(row => row.crn1 === row.crn2), false);
});

test('conflict check suppresses pairs with non-overlapping section date ranges', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2027', crn: 'D1', subject: 'ENGL', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', startDate: '08/17/2027', endDate: '10/15/2027' }),
    section({ term: 'FALL 2027', crn: 'D2', subject: 'MATH', course: '021', instructor: 'TWO, B', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', startDate: '10/18/2027', endDate: '12/10/2027' }),
    section({ term: 'FALL 2027', crn: 'D3', subject: 'HIST', course: '018', instructor: 'THREE, C', room: 'KERN 101', days: ['MO'], start: '09:30', end: '10:30', startDate: '10/01/2027', endDate: '11/01/2027' })
  ];

  const conflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap']);

  assert.equal(conflicts.length, 2);
  assert.equal(conflicts.some(row => [row.crn1, row.crn2].includes('D1') && [row.crn1, row.crn2].includes('D2')), false);
  assert.equal(conflicts.every(row => row.dateRange1 && row.dateRange2), true);
});

test('conflict check parses all-caps start and end date headers into table fields', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    {
      TERM: 'FALL 2027',
      CRN: 'SD1',
      'SUBJECT/COURSE': 'ENGL C1000',
      FACULTY: 'ONE, A',
      BUILDING: 'KERN',
      ROOM: '101',
      MONDAY: 'Y',
      'START TIME': '09:00',
      'END TIME': '10:00',
      'START DATE': '08/17/2027',
      'END DATE': '10/15/2027'
    },
    {
      TERM: 'FALL 2027',
      CRN: 'SD2',
      'SUBJECT/COURSE': 'MATH 021',
      FACULTY: 'TWO, B',
      BUILDING: 'KERN',
      ROOM: '101',
      MONDAY: 'Y',
      'START TIME': '09:30',
      'END TIME': '10:30',
      'START DATE': '09/01/2027',
      'END DATE': '12/10/2027'
    }
  ].map(row => COSEnrollmentAnalytics.normalizeRow(row));

  const conflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap']);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].startDate1, '8/17/2027');
  assert.equal(conflicts[0].endDate1, '10/15/2027');
  assert.equal(conflicts[0].startDate2, '9/1/2027');
  assert.equal(conflicts[0].endDate2, '12/10/2027');
  assert.equal(conflicts[0].dateRange1, '8/17/2027-10/15/2027');
});

test('conflict check omits cross-listed pairs and combines room instructor overlaps by default', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2027', crn: 'X1', subject: 'COMM', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', crossList: 'XL100' }),
    section({ term: 'SPRING 2027', crn: 'X2', subject: 'COMM', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', crossList: 'XL100' }),
    section({ term: 'SPRING 2027', crn: 'X3', subject: 'COMM', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', crossList: 'XL200' }),
    section({ term: 'SPRING 2027', crn: 'C1', subject: 'HIST', course: '018', instructor: 'TWO, B', room: 'KERN 102', days: ['MO'], start: '11:00', end: '12:00', crossList: '' }),
    section({ term: 'SPRING 2027', crn: 'C2', subject: 'HIST', course: '018', instructor: 'TWO, B', room: 'KERN 102', days: ['MO'], start: '11:15', end: '12:15', crossList: '' })
  ];

  const defaultConflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap']);
  assert.equal(defaultConflicts.length, 1);
  assert.equal(defaultConflicts[0].conflictType, 'Same Room + Same Instructor');
  assert.equal(defaultConflicts[0].overlapMinutes, 45);

  const withCrossListed = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap'], { omitCrossListed: false });
  assert.equal(withCrossListed.length, 4);
  assert.equal(withCrossListed.filter(row => row.conflictType === 'Same Room + Same Instructor').length, 4);
  assert.equal(withCrossListed.some(row => row.crossList1 === 'XL100' && row.crossList2 === 'XL100'), true);
  assert.equal(withCrossListed.some(row => row.crossList1 === 'XL100' && row.crossList2 === 'XL200'), true);

  const separateTypes = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap'], { separateConflictTypes: true });
  assert.equal(separateTypes.length, 2);
  assert.equal(separateTypes.some(row => row.conflictType === 'Same room overlap'), true);
  assert.equal(separateTypes.some(row => row.conflictType === 'Same instructor overlap'), true);
});

test('conflict check ignores STAFF for instructor conflicts', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2027', crn: 'S1', subject: 'MATH', course: '021', instructor: 'STAFF', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00' }),
    section({ term: 'FALL 2027', crn: 'S2', subject: 'ENGL', course: 'C1000', instructor: 'STAFF', room: 'KERN 102', days: ['MO'], start: '09:30', end: '10:30' }),
    section({ term: 'FALL 2027', crn: 'S3', subject: 'HIST', course: '018', instructor: 'STAFF', room: 'KERN 101', days: ['MO'], start: '09:30', end: '10:30' })
  ];

  const instructorConflicts = COSEnrollmentAnalytics.conflictRows(rows, ['instructorOverlap']);
  const roomConflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap']);

  assert.equal(instructorConflicts.length, 0);
  assert.equal(roomConflicts.length, 1);
  assert.equal(roomConflicts[0].conflictType, 'Same room overlap');
});

test('detailed student presence report supports campus and building group metrics', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '09:00', census: 20, cap: 30 }),
    section({ campus: 'TCCB', building: 'TCCB', roomOnly: '201', room: 'TCCB 201', days: ['TU'], start: '11:00', end: '12:15', census: 40, cap: 50 })
  ];
  const campusReport = COSEnrollmentDashboard.studentPresenceReport(rows, 'campus');
  const buildingReport = COSEnrollmentDashboard.studentPresenceReport(rows, 'building');

  assert.equal(campusReport.rows.length, 2);
  assert.equal(campusReport.metrics.peakCampus.group, 'TCCB');
  assert.equal(buildingReport.rows.some(row => row.group === 'KERN'), true);
});

test('course rotation export rows include planning fields', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = COSEnrollmentDashboard.rotationRows([
    section({ term: 'FALL 2024', division: 'Arts', subject: 'ART', course: '101' }),
    section({ term: 'FALL 2025', division: 'Arts', subject: 'ART', course: '101' }),
    section({ term: 'FALL 2026', division: 'Arts', subject: 'ART', course: '101' })
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].course, 'ART 101');
  assert.equal(rows[0].termsOfferedCount, 3);
  assert.ok(Object.hasOwn(rows[0], 'rotationStatus'));
  assert.ok(Object.hasOwn(rows[0], 'expectedNextOffering'));
});

test('dashboard consolidation summary consumes existing consolidation output', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const existingOutput = [{ type: 'Online Reduction', course: 'PS 200M', potentialSectionsRemoved: 1 }];
  const summary = COSEnrollmentDashboard.dashboardSummary([section()], [], existingOutput);

  assert.equal(summary.reduction.length, 1);
  assert.deepEqual(summary.reduction[0], existingOutput[0]);
});

test('dashboard summary export includes methodology and context rows', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([section({ division: 'Arts', census: 18, cap: 25 })], [], []);
  const rows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, {
    methodologyVersion: 'Methodology Version 1.2',
    exportedAt: '2026-06-22 10:00',
    selectedTerm: 'FALL 2026',
    divisionFilter: 'Arts',
    campusFilter: 'VIS',
    modalityFilter: 'IN PERSON',
    disciplineCourseFilter: 'Discipline: PS',
    dataSourceNote: 'Uploaded and/or archived enrollment CSV rows'
  });

  assert.ok(rows.some(row => row.Section === 'Context' && row.Metric === 'Prepared using' && row.Value === 'TIMBER Enrollment Analytics'));
  assert.ok(rows.some(row => row.Section === 'Context' && row.Metric === 'Methodology Version' && row.Value === 'Methodology Version 1.2'));
  assert.ok(rows.some(row => row.Section === 'Context' && row.Metric === 'Selected Division Filter' && row.Value === 'Arts'));
  assert.ok(rows.some(row => row.Section === 'Enrollment Health' && row.Metric === 'Current Enrollment'));
});

test('dashboard summary export respects selected division filter', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', subject: 'ART', course: '101', waitlist: 4, census: 30, cap: 30 }),
    section({ division: 'Business', subject: 'BUS', course: '101', waitlist: 4, census: 30, cap: 30 })
  ];
  const filtered = COSEnrollmentDashboard.applyDashboardFilters(rows, { division: ['Arts'] });
  const summary = COSEnrollmentDashboard.dashboardSummary(filtered, [], []);
  const exportRows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, { divisionFilter: 'Arts' });
  const groups = exportRows.map(row => row.Group).join(' ');

  assert.match(groups, /ART 101/);
  assert.doesNotMatch(groups, /BUS 101/);
  assert.ok(exportRows.some(row => row.Section === 'Context' && row.Metric === 'Selected Division Filter' && row.Value === 'Arts'));
});

test('dashboard summary export excludes fully online rows from student presence', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([
    section({ modality: 'IN PERSON', campus: 'VIS', days: ['MO'], start: '10:00', census: 20 }),
    section({ modality: 'ONLINE', campus: 'ONLINE', days: ['MO'], start: '', census: 99 })
  ], [], []);
  const exportRows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, {});
  const presenceRows = exportRows.filter(row => row.Section === 'Student Presence Analytics');
  const text = presenceRows.map(row => `${row.Group} ${row.Value}`).join(' ');

  assert.match(text, /VIS \/ MO \/ 10:00/);
  assert.doesNotMatch(text, /ONLINE/);
  assert.doesNotMatch(text, /99/);
});

test('user-facing terminology uses Part-Time Faculty wording', () => {
  const root = path.join(__dirname, '..');
  const files = [
    'index.html',
    'README.md',
    'js/enrollment-analytics.js',
    'js/enrollment/dashboard.js'
  ];
  const text = files
    .filter(file => fs.existsSync(path.join(root, file)))
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');
  const legacyWord = ['ad', 'junct'].join('');

  assert.match(text, /Part-Time Faculty/);
  assert.equal(new RegExp(legacyWord, 'i').test(text), false);
});

test('enrollment analytics report labels are operational', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.doesNotMatch(text, /WIP/);
  assert.match(text, /Enrollment Analytics Dashboard/);
  assert.match(text, /Enrollment Planning Forecast/);
  assert.match(text, /Enrollment Attrition Trend/);
  assert.match(text, /Diagnostic Attrition Rates/);
  assert.match(text, /attritionDiagnosticRates/);
  assert.match(text, /Section Consolidation Opportunities/);
  assert.match(text, /Room Utilization Map/);
  assert.match(text, /Conflict Check Report/);
  assert.match(text, /REPORTS\.conflictCheck/);
  assert.match(text, /Student Presence Analytics/);
  assert.match(text, /Open Student Presence Report/);
  assert.match(text, /REPORTS\.studentPresence/);
  assert.match(text, /Instructor Availability - Planning View/);
  assert.match(text, /Enrollment Snapshot Manager/);
  assert.match(text, /REPORTS\.snapshotManager/);
  assert.match(text, /snapSeason/);
  assert.match(text, /snapYear/);
  assert.match(text, /function snapshotTerm/);
  assert.match(text, /Term \+ CRN \+ Snapshot Type/);
  assert.match(text, /snapshotKey\(record\)/);
  assert.doesNotMatch(text, /id="snapTerm"/);
  assert.match(text, /dashDecisionSeason/);
  assert.match(text, /dashDecisionYear/);
  assert.match(text, /Use season\/year below/);
  assert.match(text, /The current selection is internally consistent and no obvious data-scope issue was detected/);
  assert.match(text, /spArchiveTerms/);
  assert.match(text, /conDecisionSeason/);
  assert.match(text, /conDecisionYear/);
  assert.match(text, /Consolidation Scope/);
  assert.doesNotMatch(text, /conDecisionTermManual/);
  assert.match(text, /iaDivision/);
  assert.match(text, /iaSubject/);
  assert.match(text, /Select All Visible Instructors/);
});

test('student presence UI and exports expose meeting frequency fields', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /id="spPresenceMode"/);
  assert.match(text, /Nominal Scheduled Presence/);
  assert.match(text, /Expected Physical Presence/);
  assert.match(text, /meetingFrequencyFactor/);
  assert.match(text, /frequencySource/);
  assert.match(text, /frequencyWarning/);
  assert.match(text, /function formatWholeNumber/);
  assert.match(text, /function formatPercent/);
  assert.match(text, /function formatFactor/);
  assert.match(text, /function formatPresenceValue/);
  assert.match(text, /\['Data Scope', '', 'group-label'\]/);
  assert.match(text, /Sections \/ CRNs Included/);
  assert.match(text, /Meeting Rows Included/);
  assert.match(text, /\['Overall Presence', '', 'group-label'\]/);
  assert.match(text, /Expected Student Presence/);
  assert.match(text, /Nominal Student Presence/);
  assert.match(text, /Frequency Adjustment Impact/);
  assert.match(text, /No adjustment applied/);
  assert.match(text, /lower than nominal/);
  assert.match(text, /Average Meeting Frequency Factor', formatFactor/);
  assert.match(text, /Average Fill Rate', formatPercent/);
  assert.match(text, /\['Capacity', '', 'group-label'\]/);
  assert.match(text, /Capacity Utilization/);
  assert.match(text, /Remaining Capacity/);
  assert.match(text, /\['Peak Activity', '', 'group-label'\]/);
  assert.match(text, /Peak Day/);
  assert.match(text, /presenceMetricLabel\(metrics\.peakCampus, presenceValueLabel\)/);
  assert.match(text, /formatPresenceValue\(item\.studentsPresent\)} \$\{unitLabel\}/);
  assert.doesNotMatch(text, /\['Students Present', metrics\.totalStudents/);
  assert.doesNotMatch(text, /Total Nominal Student Presence/);
  assert.doesNotMatch(text, /Total Expected Student Presence/);
});

test('shared report context renders filters exclusions rows and export metadata', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  [
    /function renderReportContext/,
    /function collectReportContext/,
    /function buildReportContextMetadata/,
    /function reportContextToExportRows/
  ].forEach(pattern => assert.match(app, pattern));
  assert.match(app, /No active filters/);
  assert.match(app, /Rows loaded/);
  assert.match(app, /Rows included/);
  assert.match(app, /Rows excluded/);
  assert.match(app, /Active Filters/);
  assert.match(app, /Exclusions/);
  assert.match(app, /Method \/ Calculation Context/);
  assert.match(app, /Papa\.unparse\(contextRows\)/);
  assert.match(app, /<th colspan="3">Report Context<\/th>/);
  assert.match(css, /\.report-context-panel/);
  assert.match(css, /\.report-context-chip/);
});

test('attrition summary and visible table use executive and coverage clarity labels', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /Attrition Executive Summary/);
  assert.match(text, /Data Quality & Coverage/);
  assert.match(text, /This table summarizes historical enrollment attrition by course\/group/);
  [
    'Course / Group',
    'Historical Terms Used',
    'Historical Sections / CRNs',
    'Census 1 Enrollment',
    'Census 2 Enrollment',
    'End/Final Enrollment',
    'Trend / Interpretation',
    'Confidence'
  ].forEach(label => assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('consolidation scope is limited to selected report inputs', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const loadStart = text.indexOf('async function loadConsolidationRows');
  const loadEnd = text.indexOf('function lowEnrollmentThreshold', loadStart);
  const historicalStart = text.indexOf('async function historicalPatterns');
  const historicalEnd = text.indexOf('function finalizeHistoricalMap', historicalStart);
  const loadBlock = text.slice(loadStart, loadEnd);
  const historicalBlock = text.slice(historicalStart, historicalEnd);

  assert.match(loadBlock, /const rows = uploaded;/);
  assert.doesNotMatch(loadBlock, /currentRows\(\)/);
  assert.match(loadBlock, /readArchivedRows\('conArchiveTerms'\)/);
  assert.match(loadBlock, /applyCurriculumCrosswalkToRows/);
  assert.doesNotMatch(historicalBlock, /api\/schedule/);
  assert.doesNotMatch(historicalBlock, /visibleScheduleTerms/);
  assert.match(text, /Selected Archived Terms/);
  assert.match(text, /Uploaded Terms/);
  assert.match(text, /Historical Comparison Terms Used/);
  assert.match(text, /Current Rows Count/);
  assert.match(text, /Historical Rows Count/);
  assert.match(text, /does not silently pull every archived term/);
  assert.match(text, /Curriculum Crosswalk/);
  assert.match(text, /ENGL 001 history can support ENGL C1000/);
  assert.match(text, /ONL, 71, 72, O1, OL, ONN, ONS, OO, OS, OSS, OT, OTS/);
  assert.match(text, /IP, 02, 22, 022, 02H, 02O, 02S, 02T, 02N/);
  assert.match(text, /HYB, OH, OHF, FLX, and OHS/);
});

test('dashboard source does not silently load all archived terms', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const sourceStart = text.indexOf('function dashboardSourceRows');
  const loadStart = text.indexOf('async function loadDashboardRows');
  const loadEnd = text.indexOf('function dashboardAvailableTerms', loadStart);
  const sourceBlock = text.slice(sourceStart, loadStart);
  const loadBlock = text.slice(loadStart, loadEnd);

  assert.doesNotMatch(sourceBlock, /readArchivedRows/);
  assert.doesNotMatch(sourceBlock, /analytics-archive/);
  assert.match(sourceBlock, /state\.dashboardInput/);
  assert.doesNotMatch(sourceBlock, /state\.enrollment/);
  assert.doesNotMatch(sourceBlock, /state\.demandInput/);
  assert.doesNotMatch(sourceBlock, /state\.consolidationInput/);
  assert.match(text, /id="dashboardCsv"/);
  assert.match(text, /id="dashArchiveTerms"/);
  assert.match(loadBlock, /readArchivedRows\('dashArchiveTerms', \{ reportLabel: 'Enrollment Analytics Dashboard' \}\)/);
});

test('demand forecast is scoped to selected demand uploads and archives', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const loadStart = text.indexOf('async function loadDemandRows');
  const loadEnd = text.indexOf('async function runDemand', loadStart);
  const defaultsStart = text.indexOf('function setDemandTargetDefaults');
  const defaultsEnd = text.indexOf('function captureFilterState', defaultsStart);
  const archiveStart = text.indexOf('async function readArchivedRows');
  const archiveEnd = text.indexOf('async function refreshAnalyticsArchiveOptions', archiveStart);
  const loadBlock = text.slice(loadStart, loadEnd);
  const defaultsBlock = text.slice(defaultsStart, defaultsEnd);
  const archiveBlock = text.slice(archiveStart, archiveEnd);

  assert.match(loadBlock, /readArchivedRowsWithDiagnostics\('demArchiveTerms', \{ reportLabel: 'Enrollment Planning Forecast' \}\)/);
  assert.match(loadBlock, /const rows = rowsWithWorkExperience\(uploaded, 'dem'\)/);
  assert.doesNotMatch(loadBlock, /currentRows\(\)/);
  assert.match(archiveBlock, /Could not load archived term/);
  assert.match(archiveBlock, /reportLabel/);
  assert.match(defaultsBlock, /academicYearTrailingYear/);
  assert.match(defaultsBlock, /dataset\.autoDefault/);
  assert.match(text, /Demand source load failed:/);
});

test('enrollment planning forecast exposes population toggles sections and metadata', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  assert.match(text, /Enrollment Planning Forecast/);
  assert.match(text, /id="demIncludePhysicalCampuses"/);
  assert.match(text, /id="demIncludeDualEnrollment"/);
  assert.match(text, /id="demIncludeWorkExperience"/);
  [
    'Executive Summary',
    'FTES Analysis',
    'Enrollment Analysis',
    'Schedule Supply',
    'Student Demand',
    'Recommendation Engine',
    'Data Quality & Methodology',
    'FTES Waterfall',
    'Population Composition'
  ].forEach(label => assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.match(text, /Population Types Included/);
  assert.match(text, /Instructional FTES/);
  assert.match(text, /Dual Enrollment FTES/);
  assert.match(text, /Work Experience FTES/);
  assert.match(text, /enrollment-planning-forecast-/);
  assert.match(text, /data-collapsible-id="demand-executive-summary" data-collapsible-default-open="true"/);
  assert.match(text, /data-collapsible-id="demand-ftes-analysis" data-collapsible-default-open="true"/);
  assert.match(text, /data-collapsible-id="demand-enrollment-analysis" data-collapsible-default-open="true"/);
  assert.match(text, /data-collapsible-id="demand-schedule-supply" data-collapsible-default-open="true"/);
  assert.match(text, /data-collapsible-id="demand-recommendation-engine" data-collapsible-default-open="false"/);
  assert.match(text, /data-collapsible-id="demand-diagnostics-methodology" data-collapsible-default-open="false"/);
  assert.match(text, /#demandInsights\.analytics-insights\{display:flex;flex-direction:column/);
  assert.match(text, /#demandInsights \.collapsible-section-title\{overflow:visible;text-overflow:clip;white-space:normal\}/);
  assert.match(text, /#demandInsights \.analytics-chart-panel,#demandInsights \.analytics-line-chart/);
  assert.match(css, /#demandInsights\.analytics-insights \{[\s\S]*?flex-direction: column;/);
  assert.match(css, /#demandInsights \.collapsible-section-title \{[\s\S]*?white-space: normal;/);
  assert.match(css, /#demandInsights \.demand-waterfall-panel[\s\S]*?width: 100%;/);
});

test('enrollment planning population summary reconciles instructional dual and work experience totals', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const sourceRows = [
    section({ crn: '1', census: 100, actual: 90, ftes: 10, cap: 120, campus: 'VIS' }),
    section({ crn: '2', census: 50, actual: 45, ftes: 5, cap: 60, modality: 'DUAL ENROLLMENT' }),
    section({ crn: '3', census: 25, actual: 25, ftes: 2.5, cap: 0, modality: 'WORK EXPERIENCE', isWorkExperience: true })
  ];
  const summary = COSEnrollmentAnalytics.demandPopulationSummary(sourceRows, [{ forecastLevel: 'College', expectedFtesNextTerm: 35, expectedEnrollmentNextTerm: 350 }]);
  const componentFtes = summary.instructional.projectedFtes + summary.dual.projectedFtes + summary.workExperience.projectedFtes;
  const componentEnrollment = summary.instructional.projectedEnrollment + summary.dual.projectedEnrollment + summary.workExperience.projectedEnrollment;

  assert.equal(COSEnrollmentAnalytics.demandPlanningPopulationType(sourceRows[1]), 'Dual Enrollment');
  assert.equal(COSEnrollmentAnalytics.demandPlanningPopulationType(sourceRows[2]), 'Work Experience');
  assert.ok(Math.abs(componentFtes - summary.total.projectedFtes) < 0.0001);
  assert.ok(Math.abs(componentEnrollment - summary.total.projectedEnrollment) < 0.0001);
});

test('demand term diagnostics count selected loaded filtered empty and failed terms', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const diagnostics = COSEnrollmentAnalytics.demandTermDiagnostics({
    selectedArchivedTerms: ['Fall 2025', '2024 Fall', 'SPRING 2025', 'SUMMER 2025'],
    archiveResults: [
      { term: 'FALL 2025', rows: [{}], failed: false },
      { term: 'FALL 2024', rows: [{}], failed: false },
      { term: 'SPRING 2025', rows: [], failed: false },
      { term: 'SUMMER 2025', rows: [], failed: true, error: '404 Not Found' }
    ],
    usableArchiveRows: [
      section({ term: 'FALL 2025' }),
      section({ term: 'FALL 2024' })
    ],
    usableRows: [
      section({ term: 'FALL 2025' }),
      section({ term: 'FALL 2024' })
    ],
    filteredRows: [
      section({ term: 'FALL 2025' })
    ],
    comparableRows: [
      section({ term: 'FALL 2025' })
    ],
    forecastRows: [
      section({ term: 'FALL 2025' })
    ]
  });

  assert.deepEqual([...diagnostics.selectedArchivedTerms], ['FALL 2024', 'SPRING 2025', 'SUMMER 2025', 'FALL 2025']);
  assert.deepEqual([...diagnostics.loadedTerms], ['FALL 2025', 'FALL 2024']);
  assert.deepEqual([...diagnostics.termsIncludedAfterFilters], ['FALL 2025']);
  assert.deepEqual([...diagnostics.termsUsedInForecast], ['FALL 2025']);
  assert.deepEqual([...diagnostics.termsExcludedByFilters], ['FALL 2024']);
  assert.deepEqual([...diagnostics.termsWithZeroUsableRows], ['SPRING 2025']);
  assert.equal(diagnostics.termsFailedToLoad.length, 1);
  assert.equal(diagnostics.termsFailedToLoad[0].term, 'SUMMER 2025');
});

test('demand term normalization is consistent across common labels', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();

  assert.equal(COSEnrollmentAnalytics.normalizeTermLabel('Fall 2025'), 'FALL 2025');
  assert.equal(COSEnrollmentAnalytics.normalizeTermLabel('FALL 2025'), 'FALL 2025');
  assert.equal(COSEnrollmentAnalytics.normalizeTermLabel('2025 Fall'), 'FALL 2025');
  assert.equal(COSEnrollmentAnalytics.normalizeTermLabel('202610.csv'), 'FALL 2025');
});

test('demand diagnostics count source terms used inside academic-year buckets', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const diagnostics = COSEnrollmentAnalytics.demandTermDiagnostics({
    selectedArchivedTerms: ['SUMMER 2024', 'FALL 2024', 'SPRING 2025'],
    archiveResults: [
      { term: 'SUMMER 2024', rows: [{}], failed: false },
      { term: 'FALL 2024', rows: [{}], failed: false },
      { term: 'SPRING 2025', rows: [{}], failed: false }
    ],
    usableArchiveRows: [
      section({ term: 'SUMMER 2024' }),
      section({ term: 'FALL 2024' }),
      section({ term: 'SPRING 2025' })
    ],
    usableRows: [
      section({ term: 'SUMMER 2024' }),
      section({ term: 'FALL 2024' }),
      section({ term: 'SPRING 2025' })
    ],
    filteredRows: [
      section({ term: 'SUMMER 2024' }),
      section({ term: 'FALL 2024' }),
      section({ term: 'SPRING 2025' })
    ],
    comparableRows: [
      section({ term: 'FY/AY 2025', sourceTerm: 'SUMMER 2024' }),
      section({ term: 'FY/AY 2025', sourceTerm: 'FALL 2024' }),
      section({ term: 'FY/AY 2025', sourceTerm: 'SPRING 2025' })
    ],
    forecastRows: [
      section({ term: 'FY/AY 2025', sourceTerm: 'SUMMER 2024' }),
      section({ term: 'FY/AY 2025', sourceTerm: 'FALL 2024' }),
      section({ term: 'FY/AY 2025', sourceTerm: 'SPRING 2025' })
    ]
  });

  assert.deepEqual([...diagnostics.termsUsedInForecast], ['SUMMER 2024', 'FALL 2024', 'SPRING 2025']);
});

test('demand trend chart data includes enrollment series and forecast point', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const data = COSEnrollmentAnalytics.buildEnrollmentTrendChartData([
    { term: 'FALL 2023', census: 100, final: 96, forecast: 98, fillRate: 0.8, waitlist: 4, ftes: 30 },
    { term: 'FALL 2024', census: 120, final: 115, forecast: 118, fillRate: 0.9, waitlist: 7, ftes: 36 }
  ], 132, 'FALL 2025');

  assert.deepEqual([...data.categories], ['FALL 2023', 'FALL 2024', 'FALL 2025']);
  assert.equal(data.series.length, 3);
  assert.deepEqual([...data.series.map(series => series.name)], ['Census enrollment', 'Final/current enrollment', 'Forecast enrollment']);
  assert.equal(data.series[2].values[2], 132);
  assert.match(data.tooltips[0], /Fill rate/);
});

test('demand FTES chart data includes cap and exceed flag', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const data = COSEnrollmentAnalytics.buildFtesTrendChartData([
    { term: 'FALL 2023', ftes: 30 },
    { term: 'FALL 2024', ftes: 36 }
  ], 42, 40, 'FALL 2025');

  assert.equal(data.exceedsCap, true);
  assert.deepEqual([...data.categories], ['FALL 2023', 'FALL 2024', 'FALL 2025']);
  assert.deepEqual([...data.series.map(series => series.name)], ['Historical FTES', 'Forecast FTES', 'FTES cap']);
  assert.equal(data.series[2].values[2], 40);
});

test('demand course distribution chart data separates expanding and softening courses', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const data = COSEnrollmentAnalytics.buildCourseDemandDistributionChartData([
    { forecastLevel: 'Course', course: 'ART 101', avgCensusEnrollment: 20, expectedEnrollmentNextTerm: 28, adjustedForecastGrowth: 0.2, forecastConfidence: 'High' },
    { forecastLevel: 'Course', course: 'BUS 101', avgCensusEnrollment: 30, expectedEnrollmentNextTerm: 24, adjustedForecastGrowth: -0.15, forecastConfidence: 'Medium' },
    { forecastLevel: 'Division', course: 'All courses', adjustedForecastGrowth: 0.5 }
  ]);

  assert.equal(data.length, 2);
  assert.deepEqual([...data.map(row => row.course)], ['ART 101', 'BUS 101']);
  assert.deepEqual([...data.map(row => row.direction)], ['Expanding', 'Softening']);
  assert.equal(data[0].confidence, 'High');
  assert.equal(data[0].demandVariance, 8);
  assert.equal(data[1].demandVariance, -6);
  assert.equal(data[0].forecastEnrollment, 28);
});

test('demand redesign helpers distinguish lifecycle expected enrollment and confidence', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const trends = [
    { term: 'FALL 2022', census: 100, final: 96, fillRate: 0.78, waitlist: 2, ftes: 30 },
    { term: 'FALL 2023', census: 120, final: 118, fillRate: 0.84, waitlist: 4, ftes: 35 },
    { term: 'FALL 2024', census: 150, final: 147, fillRate: 0.92, waitlist: 8, ftes: 42 }
  ];
  const simpleAverage = Math.round((100 + 120 + 150) / 3);
  const expected = COSEnrollmentAnalytics.demandHistoricalExpectedEnrollment(trends);
  const future = COSEnrollmentAnalytics.demandLifecycleStatus(trends, { term: 'FALL 2026' });
  const active = COSEnrollmentAnalytics.demandLifecycleStatus([{ term: 'FALL 2026', census: 0, final: 40 }], { term: 'FALL 2026' });
  const completed = COSEnrollmentAnalytics.demandLifecycleStatus([{ term: 'FALL 2026', census: 90, final: 88 }], { term: 'FALL 2026' });
  const confidence = COSEnrollmentAnalytics.demandForecastConfidenceScore([{ forecastConfidence: 'High' }, { forecastConfidence: 'Medium' }]);

  assert.notEqual(expected, simpleAverage);
  assert.equal(future.status, 'future');
  assert.equal(active.status, 'active');
  assert.equal(active.currentEnrollment, 40);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.finalEnrollment, 90);
  assert.equal(confidence.label, 'Medium');
});

test('demand executive summary recommendations and diagnostics support decision story', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    { forecastLevel: 'College', expectedEnrollmentNextTerm: 170, expectedFtesNextTerm: 52, forecastConfidence: 'Medium', capacityGuidance: 'Moderate growth - monitor for added capacity.' },
    { forecastLevel: 'Course', course: 'ART 101', avgCensusEnrollment: 20, expectedEnrollmentNextTerm: 30, adjustedForecastGrowth: 0.2, forecastConfidence: 'High', capacityGuidance: 'Expanding demand - plan additional capacity.' },
    { forecastLevel: 'Course', course: 'BUS 101', avgCensusEnrollment: 30, expectedEnrollmentNextTerm: 24, adjustedForecastGrowth: -0.2, forecastConfidence: 'Medium', capacityGuidance: 'Softening demand - review capacity assumptions.' }
  ];
  const trends = [
    { term: 'FALL 2023', census: 120, final: 118, fillRate: 0.85, waitlist: 4, ftes: 36 },
    { term: 'FALL 2024', census: 140, final: 138, fillRate: 0.94, waitlist: 9, ftes: 44 }
  ];
  const summary = COSEnrollmentAnalytics.demandExecutiveSummary(rows, trends, { target: { term: 'FALL 2026' }, ftesCap: 50, annualFtes: 52 }, {});
  const findings = COSEnrollmentAnalytics.demandRecommendationSummary(rows, [{ pattern: 'M | 10:00 | HYBRID | COS', fillRate: 0.96, waitlist: 5, sections: 2 }], summary);
  const pattern = COSEnrollmentAnalytics.parseDemandPattern('M | 10:00 | HYBRID | COS');
  const diagnostics = COSEnrollmentAnalytics.demandTermDiagnostics({
    selectedArchivedTerms: ['FALL 2023', 'FALL 2024', 'FALL 2025'],
    archiveResults: [{ term: 'FALL 2023' }, { term: 'FALL 2024' }, { term: 'FALL 2025' }],
    usableRows: [{ term: 'FALL 2023' }, { term: 'FALL 2024' }, { term: 'FALL 2025' }],
    filteredRows: [{ term: 'FALL 2023' }, { term: 'FALL 2024' }, { term: 'FALL 2025' }],
    comparableRows: [{ term: 'FALL 2023' }, { term: 'FALL 2024' }],
    forecastRows: [{ term: 'FALL 2024' }]
  });

  assert.match(summary.health, /Watch|Intervention Recommended|On Track/);
  assert.ok(summary.drivers.length >= 3);
  assert.ok(findings.some(row => row.category === 'Expansion Candidate'));
  assert.ok(findings.some(row => row.category === 'Waitlist Pressure'));
  assert.equal(pattern.day, 'M');
  assert.equal(JSON.stringify(diagnostics.termsExcludedByForecastTarget), JSON.stringify(['FALL 2025']));
  assert.equal(JSON.stringify(diagnostics.termsExcludedByAnalysisWindow), JSON.stringify(['FALL 2023']));
});

test('demand redesign sections and metric definitions are wired', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const registry = require('../js/core/metric-definitions.js');

  ['Executive Summary', 'Executive Recommendation Summary', 'Recommended Administrative Actions', 'Simplified Planning Gap Table', 'Scenario Summary', 'Detailed Calculation Tables', 'FTES Analysis', 'Enrollment Analysis', 'Schedule Supply', 'Student Demand', 'Recommendation Engine', 'Data Quality & Methodology', 'Show All Recommendations', 'Forecast Accuracy / Back-test'].forEach(label => {
    assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(text, /function demandExecutiveRecommendation/);
  assert.match(text, /function demandSimplifiedPlanningRows/);
  assert.match(text, /function demandScenarioSummaryPanel/);
  assert.match(text, /function demandPlanningExportRows/);
  assert.match(text, /demandExportRows/);
  assert.match(text, /Forecast Scenario \/ Model Projection|Forecast Scenario/);
  assert.match(text, /This is a planning signal, not an automatic add, cancellation, or staffing decision/);
  assert.match(text, /High, Medium, or Low confidence/);
  assert.match(text, /demand-zero-track/);
  assert.match(text, /Below Expected/);
  assert.match(text, /Above Expected/);
  ['current-enrollment', 'projected-final-enrollment', 'historical-expected-enrollment', 'historical-baseline', 'year-over-year-growth', 'recency-weighted-growth', 'trend-projection', 'schedule-adjusted-projection', 'final-expected-projection', 'expected-range', 'expected-ftes-range', 'current-variance', 'projected-variance', 'forecast-confidence', 'forecast-gap', 'ftes-cap-position', 'expanding-demand', 'softening-demand', 'demand-above-expected', 'demand-below-expected'].forEach(id => {
    assert.ok(registry.get(id), `${id} definition missing`);
  });
  assert.match(text, /Expected FTES Range/);
  assert.match(text, /expectedFtesRangeDisplay/);
  assert.match(text, /expectedFtesRangeLow/);
  assert.match(text, /expectedFtesRangeHigh/);
});

test('trend projection engine replaces simple historical average for planning forecasts', () => {
  const engine = require('../js/enrollment/trend-projection.js');
  const upward = [
    { term: 'FALL 2022', enrollment: 100, seatsOffered: 140, scheduledClassOfferings: 5, ftes: 30 },
    { term: 'FALL 2023', enrollment: 110, seatsOffered: 145, scheduledClassOfferings: 5, ftes: 33 },
    { term: 'FALL 2024', enrollment: 125, seatsOffered: 160, scheduledClassOfferings: 6, ftes: 37 },
    { term: 'FALL 2025', enrollment: 145, seatsOffered: 175, scheduledClassOfferings: 6, ftes: 43 }
  ];
  const downward = upward.map((row, index) => ({ ...row, enrollment: [145, 130, 115, 100][index] }));
  const flat = upward.map(row => ({ ...row, enrollment: 120 }));
  const upProjection = engine.buildProjection({ termTotals: upward });
  const downProjection = engine.buildProjection({ termTotals: downward });
  const flatProjection = engine.buildProjection({ termTotals: flat });

  assert.ok(upProjection.trendProjection.enrollment > 120, 'upward trend should project above the simple average');
  assert.ok(downProjection.trendProjection.enrollment < 122.5, 'downward trend should project below the simple average');
  assert.ok(Math.abs(flatProjection.trendProjection.enrollment - flatProjection.historicalBaseline.enrollment) < 1);
  assert.ok(upProjection.recencyWeights.at(-1).weight > upProjection.recencyWeights[0].weight);
  assert.equal(upProjection.confidence, 'High');
  assert.ok(upProjection.expectedRange.low < upProjection.expectedRange.mostLikely);
  assert.ok(upProjection.expectedRange.high > upProjection.expectedRange.mostLikely);
  assert.ok(upProjection.expectedFtesRange.low < upProjection.expectedFtesRange.mostLikely);
  assert.ok(upProjection.expectedFtesRange.high > upProjection.expectedFtesRange.mostLikely);
});

test('demand expected FTES range mirrors projection range behavior and export fields', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const engine = require('../js/enrollment/trend-projection.js');
  const stable = engine.buildProjection({
    termTotals: [
      { term: 'FALL 2022', enrollment: 100, ftes: 30 },
      { term: 'FALL 2023', enrollment: 105, ftes: 31 },
      { term: 'FALL 2024', enrollment: 110, ftes: 32 },
      { term: 'FALL 2025', enrollment: 115, ftes: 33 }
    ]
  });
  const volatile = engine.buildProjection({
    termTotals: [
      { term: 'FALL 2022', enrollment: 100, ftes: 20 },
      { term: 'FALL 2023', enrollment: 105, ftes: 42 },
      { term: 'FALL 2024', enrollment: 110, ftes: 24 },
      { term: 'FALL 2025', enrollment: 115, ftes: 52 }
    ]
  });
  const stableWidth = stable.expectedFtesRange.high - stable.expectedFtesRange.low;
  const volatileWidth = volatile.expectedFtesRange.high - volatile.expectedFtesRange.low;
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.ok(stable.expectedRange.low < stable.expectedRange.high);
  assert.ok(stable.expectedFtesRange.low < stable.expectedFtesRange.high);
  assert.ok(volatileWidth > stableWidth, 'FTES range should widen when FTES volatility increases');
  assert.match(COSEnrollmentAnalytics.formatDemandFtesRange(4480, 4760), /^4480\.0–4760\.0$/);
  assert.match(source, /\['Expected FTES Range', formatDemandFtesRange/);
  assert.match(source, /expectedFtesRangeDisplay/);
  assert.match(source, /expectedFtesRangeLow/);
  assert.match(source, /expectedFtesRangeHigh/);
  assert.match(source, /Expected FTES Range', value: 'Uses the same trend projection confidence\/range method/);
});

test('trend projection engine adjusts for current schedule supply', () => {
  const engine = require('../js/enrollment/trend-projection.js');
  const termTotals = [
    { term: 'FALL 2022', enrollment: 100, seatsOffered: 100, scheduledClassOfferings: 5 },
    { term: 'FALL 2023', enrollment: 100, seatsOffered: 100, scheduledClassOfferings: 5 },
    { term: 'FALL 2024', enrollment: 100, seatsOffered: 100, scheduledClassOfferings: 5 }
  ];
  const larger = engine.buildProjection({ termTotals, currentTotals: { seatsOffered: 120, scheduledClassOfferings: 6 } });
  const smaller = engine.buildProjection({ termTotals, currentTotals: { seatsOffered: 80, scheduledClassOfferings: 4 } });

  assert.ok(larger.scheduleAdjustedProjection.enrollment > larger.trendProjection.enrollment);
  assert.ok(smaller.scheduleAdjustedProjection.enrollment < smaller.trendProjection.enrollment);
});

test('archive inspection exposes parsed archived schedule validation', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /archiveInspection: 'archive-inspection'/);
  assert.match(text, /Archived Schedule Inspector/);
  assert.match(text, /archiveInspectionTerm/);
  assert.match(text, /archiveInspectionCsv/);
  assert.match(text, /inspectArchivedSchedule/);
  assert.match(text, /Export Parsed Archive CSV/);
  assert.match(text, /Raw Row Count/);
  assert.match(text, /Normalized Row Count/);
  assert.match(text, /Distinct CRN Count/);
  assert.match(text, /Distinct Physical CRNs/);
  assert.match(text, /Online CRNs/);
  assert.match(text, /TBA\/No Fixed Time Rows/);
  assert.match(text, /Cross-Listed Rows/);
  assert.match(text, /Dual Enrollment Rows/);
  assert.match(text, /Work Experience Rows/);
  assert.match(text, /Term Value Detected/);
  assert.match(text, /Campus Distribution/);
  assert.match(text, /Modality Distribution/);
  assert.match(text, /Instructional Method Code Distribution/);
  assert.match(text, /Day\/Time Distribution/);
  assert.match(text, /archiveInspectionRows/);
  assert.match(text, /exportArchiveInspection/);
});

test('online placeholder times normalize to Online/TBA', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'SPRING 2027',
    CRN: '90001',
    Subject: 'HIST',
    Course: '018',
    'Instructional Method': 'ONL',
    Days: 'TBA',
    Start_Time: '00:00',
    End_Time: '00:59',
    CENSUS_ENROLL: '20',
    'Max Enrollment': '40'
  });

  assert.equal(row.modality, 'ONLINE');
  assert.equal(row.timeBlock, 'ONLINE/TBA');
  assert.equal(COSEnrollmentAnalytics.isOnlinePlaceholderTime(row), true);
});

test('development physical interval calculations exclude online and TBA rows by default', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const physical = section({ crn: 'IP1', modality: 'IN PERSON', days: ['MO'], dayPattern: 'M', start: '09:00', end: '10:00', timeBlock: '09:00-09:59', census: 20, actual: 18 });
  const hybrid = section({ crn: 'HY1', modality: 'HYBRID', days: ['TU'], dayPattern: 'T', start: '10:00', end: '11:00', timeBlock: '10:00-10:59', census: 15, actual: 15 });
  const onlineFixed = section({ crn: 'ON1', modality: 'ONLINE', days: ['MO'], dayPattern: 'M', start: '09:00', end: '10:00', timeBlock: 'ONLINE/TBA', census: 40, actual: 40 });
  const onlinePlaceholder = section({ crn: 'ON2', modality: 'ONLINE', days: ['MO'], dayPattern: 'M', start: '00:00', end: '19:00', timeBlock: '00:00-00:59', census: 50, actual: 50 });
  const tba = section({ crn: 'TBA1', modality: 'TBA', days: [], dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 10, actual: 10 });

  const defaultRows = COSEnrollmentAnalytics.physicalIntervalRows([physical, hybrid, onlineFixed, onlinePlaceholder, tba]);
  assert.deepEqual(defaultRows.map(row => row.crn).sort(), ['HY1', 'IP1']);

  const withOnline = COSEnrollmentAnalytics.physicalIntervalRows([physical, onlineFixed, onlinePlaceholder, tba], { includeOnline: true });
  assert.deepEqual(withOnline.map(row => row.crn).sort(), ['IP1']);
});

test('development modality helpers support physical-only and all-modality selections', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const inPerson = COSEnrollmentAnalytics.normalizeRow({ CRN: '10001', 'Instructional Method': 'IP' });
  const hybrid = COSEnrollmentAnalytics.normalizeRow({ CRN: '10002', 'Instructional Method': 'HYB' });
  const online = COSEnrollmentAnalytics.normalizeRow({ CRN: '10003', 'Instructional Method': 'ONL' });
  const unknown = COSEnrollmentAnalytics.normalizeRow({ CRN: '10004', 'Instructional Method': 'ZZZ' });

  assert.equal(COSEnrollmentAnalytics.modalityMatchesLabelList(inPerson, ['In-Person', 'Hybrid']), true);
  assert.equal(COSEnrollmentAnalytics.modalityMatchesLabelList(hybrid, ['In-Person', 'Hybrid']), true);
  assert.equal(COSEnrollmentAnalytics.modalityMatchesLabelList(online, ['In-Person', 'Hybrid']), false);
  assert.equal(COSEnrollmentAnalytics.modalityMatchesLabelList(online, ['In-Person', 'Hybrid', 'Online']), true);
  assert.equal(COSEnrollmentAnalytics.modalityMatchesLabelList(unknown, ['In-Person', 'Hybrid', 'Online']), false);
  assert.equal(COSEnrollmentAnalytics.modalityMatchesLabelList(unknown, ['Unknown']), true);
});

test('development faculty modality helper supports physical-only and all-modality selections', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const lecture = { insmCode: 'IP' };
  const hybrid = { insmCode: 'HYB' };
  const online = { insmCode: 'ONL' };
  const unknown = { insmCode: 'ZZZ' };

  assert.equal(COSEnrollmentAnalytics.facultyModalityMatchesLabelList(lecture, ['In-Person', 'Hybrid']), true);
  assert.equal(COSEnrollmentAnalytics.facultyModalityMatchesLabelList(hybrid, ['In-Person', 'Hybrid']), true);
  assert.equal(COSEnrollmentAnalytics.facultyModalityMatchesLabelList(online, ['In-Person', 'Hybrid']), false);
  assert.equal(COSEnrollmentAnalytics.facultyModalityMatchesLabelList(online, ['In-Person', 'Hybrid', 'Online']), true);
  assert.equal(COSEnrollmentAnalytics.facultyModalityMatchesLabelList(unknown, ['Unknown']), true);
});

test('development time buckets do not create midnight values from online placeholders', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ crn: 'IP1', modality: 'IN PERSON', days: ['MO'], dayPattern: 'M', start: '09:00', end: '10:00', timeBlock: '09:00-09:59', census: 20, actual: 18 }),
    section({ crn: 'ON2', modality: 'ONLINE', days: ['MO'], dayPattern: 'M', start: '00:00', end: '19:00', timeBlock: '00:00-00:59', census: 50, actual: 50 })
  ];
  const supply = COSEnrollmentAnalytics.buildSupplyDemandBuckets(rows, 'studentPresence');
  const activeRows = supply.rows.filter(row => row.sections || row.studentPresence);

  assert.equal(activeRows.some(row => row.minutes < 6 * 60), false);
  assert.equal(activeRows.length, 2);
  assert.equal(activeRows.every(row => row.studentPresence === 20), true);
});

test('supply vs demand standard planning window excludes weekends and constrained starts', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ crn: 'SUN', days: ['SU'], dayPattern: 'U', start: '09:00', end: '10:00', census: 10 }),
    section({ crn: 'EARLY', days: ['MO'], dayPattern: 'M', start: '07:30', end: '08:30', census: 10 }),
    section({ crn: 'MON8', days: ['MO'], dayPattern: 'M', start: '08:00', end: '09:00', census: 20 }),
    section({ crn: 'MON730P', days: ['MO'], dayPattern: 'M', start: '19:30', end: '20:30', census: 15 }),
    section({ crn: 'MON830P', days: ['MO'], dayPattern: 'M', start: '20:30', end: '21:30', census: 15 }),
    section({ crn: 'FR230', days: ['FR'], dayPattern: 'F', start: '14:30', end: '16:00', census: 12 }),
    section({ crn: 'FR330', days: ['FR'], dayPattern: 'F', start: '15:30', end: '16:30', census: 12 }),
    section({ crn: 'SAT', days: ['SA'], dayPattern: 'S', start: '09:00', end: '10:00', census: 10 })
  ];

  const built = COSEnrollmentAnalytics.buildSupplyDemandBuckets(rows, 'studentPresence', { planningWindow: true });
  const activeRows = built.rows.filter(row => row.sections || row.studentPresence);

  assert.equal(JSON.stringify(built.dayKeys), JSON.stringify(['MO', 'TU', 'WE', 'TH', 'FR']));
  assert.equal(activeRows.some(row => row.day === 'Sunday' || row.day === 'Saturday'), false);
  assert.equal(activeRows.some(row => row.minutes < 8 * 60), false);
  assert.equal(activeRows.some(row => row.day === 'Friday' && row.minutes >= 15 * 60), false);
  assert.equal(activeRows.some(row => row.day === 'Monday' && row.time === '8:00 AM' && row.studentPresence === 20), true);
  assert.equal(activeRows.some(row => row.day === 'Friday' && row.time === '2:30 PM' && row.studentPresence === 12), true);
  assert.equal(built.excludedOutsidePlanningWindow, 5);
});

test('development time buckets include online only when explicitly selected and fixed time is real', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ crn: 'ON1', modality: 'ONLINE', days: ['MO'], dayPattern: 'M', start: '09:00', end: '10:00', timeBlock: '09:00-09:59', census: 40, actual: 40 })
  ];

  assert.equal(COSEnrollmentAnalytics.buildStudentChoiceBuckets(rows, 'uniqueCourses').filter(row => row.sections).length, 0);
  const withOnline = COSEnrollmentAnalytics.buildStudentChoiceBuckets(rows, 'uniqueCourses', { includeOnline: true }).filter(row => row.sections);
  assert.equal(withOnline.length, 2);
  assert.equal(withOnline[0].enrollment, 40);
});

test('schedule opportunity heatmap crops to active instructional window after filters', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ crn: 'AM1', modality: 'IN PERSON', days: ['MO'], dayPattern: 'M', start: '07:00', end: '08:00', timeBlock: '07:00-07:59', census: 20, actual: 18 }),
    section({ crn: 'PM1', modality: 'HYBRID', days: ['MO'], dayPattern: 'M', start: '20:30', end: '21:00', timeBlock: '20:30-20:59', census: 12, actual: 12 })
  ];
  const cropped = COSEnrollmentAnalytics.buildStudentChoiceBuckets(rows, 'studentPresence', { dynamicWindow: true });
  const croppedSlots = [...new Set(cropped.map(row => row.minutes))];
  const fullDay = COSEnrollmentAnalytics.buildStudentChoiceBuckets(rows, 'studentPresence', { dynamicWindow: true, showInactiveHours: true });
  const fullDaySlots = [...new Set(fullDay.map(row => row.minutes))];

  assert.equal(cropped[0].visibleWindowStart, 7 * 60);
  assert.equal(cropped[0].visibleWindowEnd, 21 * 60);
  assert.equal(croppedSlots[0], 7 * 60);
  assert.equal(croppedSlots.at(-1), 20 * 60 + 30);
  assert.equal(croppedSlots.length < fullDaySlots.length, true);
  assert.equal(fullDaySlots.length, 48);
  assert.equal(fullDay[0].visibleWindowStart, 0);
  assert.equal(fullDay[0].visibleWindowEnd, 24 * 60);
  assert.equal(fullDay[0].showInactiveHours, true);
});

test('schedule opportunity online treatment excludes asynchronous online from full-day heatmap pollution', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ crn: 'ASY1', modality: 'ONLINE', days: [], dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 45, actual: 45 }),
    section({ crn: 'ASY2', modality: 'ONLINE', days: ['MO'], dayPattern: 'M', start: '00:00', end: '19:00', timeBlock: '00:00-00:59', census: 30, actual: 30 }),
    section({ crn: 'SYN1', modality: 'ONLINE', days: ['TU'], dayPattern: 'T', start: '10:00', end: '11:00', timeBlock: '10:00-10:59', census: 25, actual: 25 })
  ];
  const physicalOnly = COSEnrollmentAnalytics.buildStudentChoiceBuckets(rows, 'studentPresence', { onlineTreatment: 'physical', dynamicWindow: true });
  const scheduledOnline = COSEnrollmentAnalytics.buildStudentChoiceBuckets(rows, 'studentPresence', { onlineTreatment: 'scheduled-online', dynamicWindow: true });
  const allOnline = COSEnrollmentAnalytics.buildStudentChoiceBuckets(rows, 'studentPresence', { onlineTreatment: 'all-online', includeOnline: true, dynamicWindow: true, showInactiveHours: true });
  const scheduledActive = scheduledOnline.filter(row => row.sections || row.studentPresence);
  const allActive = allOnline.filter(row => row.sections || row.studentPresence);

  assert.equal(physicalOnly.filter(row => row.sections || row.studentPresence).length, 0);
  assert.equal(JSON.stringify(scheduledActive.map(row => `${row.dayCode}|${row.minutes}`)), JSON.stringify(['TU|600', 'TU|630']));
  assert.equal(scheduledActive.every(row => row.studentPresence === 25), true);
  assert.equal(JSON.stringify(allActive.map(row => `${row.dayCode}|${row.minutes}`)), JSON.stringify(['TU|600', 'TU|630']));
  assert.equal(allOnline[0].onlineTreatment, 'all-online');
});

test('schedule opportunity heatmap controls and export metadata are wired', () => {
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(analytics, /id="studentChoiceOnlineTreatment"/);
  assert.match(analytics, /Physical Scheduling Only/);
  assert.match(analytics, /Include Scheduled Online/);
  assert.match(analytics, /Include All Online/);
  assert.match(analytics, /id="studentChoiceShowInactiveHours"/);
  assert.match(analytics, /Show inactive hours/);
  assert.match(analytics, /Time-based modality treatment/);
  assert.match(analytics, /visibleWindowStart/);
  assert.match(analytics, /visibleWindowEnd/);
  assert.match(analytics, /showInactiveHours/);
  assert.match(analytics, /timeBasedModalityTreatment/);
});

test('scheduling recommendations are not generated from online placeholder time blocks', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ crn: 'ON2', modality: 'ONLINE', days: ['MO'], dayPattern: 'M', start: '00:00', end: '19:00', timeBlock: '00:00-00:59', cap: 10, census: 10, actual: 10, waitlist: 25 })
  ];
  const recommendations = COSEnrollmentAnalytics.buildSchedulingRecommendations(rows);

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].category, 'Insufficient evidence');
  assert.equal(recommendations[0].dayTimeBlock, 'N/A');
});

test('scheduling recommendations suppress 9:30 PM expansion choice-gap candidates by default', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({
      crn: 'NIGHT1',
      subject: 'HIST',
      course: '018',
      modality: 'IN PERSON',
      days: ['MO'],
      dayPattern: 'M',
      start: '21:30',
      end: '22:00',
      timeBlock: '21:30-21:59',
      cap: 30,
      census: 30,
      actual: 30,
      waitlist: 12
    })
  ];
  const diagnostics = [];
  const recommendations = COSEnrollmentAnalytics.buildSchedulingRecommendations(rows, { outsidePlanningDiagnostics: diagnostics });
  const activeCategories = recommendations.map(row => row.category);

  assert.equal(activeCategories.includes('Hidden Demand'), false);
  assert.equal(activeCategories.includes('Choice Gap'), false);
  assert.equal(activeCategories.includes('Expansion Candidate'), false);
  assert.ok(diagnostics.some(row => row.category === 'Hidden Demand' && /9:30 PM/.test(row.timeBlock)));

  const expanded = COSEnrollmentAnalytics.buildSchedulingRecommendations(rows, { planningWindow: { earliest: '07:00', latest: '22:00' } });
  const expandedCategories = expanded.map(row => row.category);
  assert.equal(expandedCategories.includes('Hidden Demand'), true);
  assert.equal(expandedCategories.includes('Choice Gap'), true);
  assert.equal(expandedCategories.includes('Expansion Candidate'), true);
});

test('faculty development heatmap excludes online rows by default and permits explicit online fixed-time rows', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    { crn: 'F1', facultyType: 'FULL_TIME', insmCode: 'IP', days: ['MO'], startTime: '09:00', endTime: '10:00', actualEnroll: 20, maxEnroll: 30, lhe: 1, facultyId: '1', meetingType: 'Lecture' },
    { crn: 'F2', facultyType: 'PART_TIME', insmCode: 'ONL', days: ['MO'], startTime: '09:00', endTime: '10:00', actualEnroll: 40, maxEnroll: 40, lhe: 1, facultyId: '2', meetingType: 'Lecture' },
    { crn: 'F3', facultyType: 'PART_TIME', insmCode: 'ONL', days: ['MO'], startTime: '00:00', endTime: '00:59', actualEnroll: 50, maxEnroll: 50, lhe: 1, facultyId: '3', meetingType: 'Lecture' }
  ];

  const defaultBuckets = COSEnrollmentAnalytics.buildFacultyHeatmapBuckets(rows, 'sections');
  const onlineBuckets = COSEnrollmentAnalytics.buildFacultyHeatmapBuckets(rows, 'sections', { includeOnline: true });

  assert.equal(defaultBuckets.rows.filter(row => row.sections).reduce((total, row) => total + row.sections, 0), 2);
  assert.equal(onlineBuckets.rows.filter(row => row.sections).reduce((total, row) => total + row.sections, 0), 4);
  assert.equal(onlineBuckets.rows.some(row => row.minutes < 6 * 60 && row.sections), false);
});

test('prime time analysis excludes online by default and includes it only when selected', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    { crn: 'F1', facultyType: 'FULL_TIME', insmCode: 'IP', days: ['MO'], startTime: '09:00', endTime: '10:00', actualEnroll: 20, maxEnroll: 30, lhe: 1, facultyId: '1', meetingType: 'Lecture' },
    { crn: 'F2', facultyType: 'PART_TIME', insmCode: 'ONL', days: ['MO'], startTime: '09:00', endTime: '10:00', actualEnroll: 40, maxEnroll: 40, lhe: 1, facultyId: '2', meetingType: 'Lecture' },
    { crn: 'F3', facultyType: 'PART_TIME', insmCode: 'IP', days: [], startTime: '', endTime: '', actualEnroll: 15, maxEnroll: 20, lhe: 1, facultyId: '3', meetingType: 'Lab' }
  ];
  const analysis = COSEnrollmentAnalytics.primeTimeAnalysisRows(rows);
  const fullTime = analysis.find(row => row.category === 'Full-Time Faculty Instructional Meetings');
  const partTime = analysis.find(row => row.category === 'Part-Time Faculty Instructional Meetings');
  const enrollment = analysis.find(row => row.category === 'Enrollment');

  assert.equal(fullTime.totalValue, 1);
  assert.equal(partTime.totalValue, 0);
  assert.equal(enrollment.totalValue, 20);

  const withOnline = COSEnrollmentAnalytics.primeTimeAnalysisRows(rows, ['In-Person', 'Hybrid', 'Online']);
  const onlinePartTime = withOnline.find(row => row.category === 'Part-Time Faculty Instructional Meetings');
  const onlineEnrollment = withOnline.find(row => row.category === 'Enrollment');

  assert.equal(onlinePartTime.totalValue, 1);
  assert.equal(onlineEnrollment.totalValue, 60);
});

test('historical aggregation modes and summer weighting support planning benchmarks', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const values = [
    { term: 'FALL 2024', value: 10 },
    { term: 'SPRING 2025', value: 40 },
    { term: 'SUMMER 2025', value: 100 },
    { term: 'FALL 2025', value: 20 }
  ];
  const fallWeights = COSEnrollmentAnalytics.historicalTermWeights(values.map(row => row.term), 'FALL 2026');
  const summerWeights = COSEnrollmentAnalytics.historicalTermWeights(values.map(row => row.term), 'SUMMER 2026');
  assert.equal(fallWeights.find(row => row.term === 'SUMMER 2025').weight, 0.25);
  assert.equal(summerWeights.find(row => row.term === 'SUMMER 2025').weight, 1);

  assert.equal(COSEnrollmentAnalytics.aggregateHistoricalValues(values, 'average', fallWeights).selectedValue, 42.5);
  assert.equal(COSEnrollmentAnalytics.aggregateHistoricalValues(values, 'total', fallWeights).selectedValue, 170);
  assert.equal(COSEnrollmentAnalytics.aggregateHistoricalValues(values, 'recent', fallWeights).selectedValue, 20);
  assert.equal(Math.round(COSEnrollmentAnalytics.aggregateHistoricalValues(values, 'weighted', fallWeights).selectedValue), 28);
});

test('prime time aggregation separates unique CRN offerings from instructional meetings', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    { term: 'FALL 2025', crn: '10001', facultyType: 'FULL_TIME', insmCode: 'IP', days: ['MO'], dayPattern: 'M', startTime: '09:00', endTime: '10:00', actualEnroll: 20, maxEnroll: 30, lhe: 1, facultyId: '1', meetingType: 'Lecture' },
    { term: 'FALL 2025', crn: '10001', facultyType: 'FULL_TIME', insmCode: 'IP', days: ['MO'], dayPattern: 'M', startTime: '09:00', endTime: '10:00', actualEnroll: 20, maxEnroll: 30, lhe: 1, facultyId: '1', meetingType: 'Lecture' },
    { term: 'FALL 2025', crn: '10001', facultyType: 'FULL_TIME', insmCode: 'IP', days: ['WE'], dayPattern: 'W', startTime: '13:00', endTime: '15:00', actualEnroll: 20, maxEnroll: 30, lhe: 1, facultyId: '1', meetingType: 'Lab' },
    { term: 'FALL 2026', crn: '20001', facultyType: 'PART_TIME', insmCode: 'IP', days: ['MO'], dayPattern: 'M', startTime: '11:00', endTime: '12:00', actualEnroll: 10, maxEnroll: 25, lhe: 1, facultyId: '2', meetingType: 'Activity' }
  ];

  const definition = { start: 9 * 60, end: 15 * 60, days: new Set(['MO', 'TU', 'WE', 'TH']) };
  const averageRows = COSEnrollmentAnalytics.primeTimeAnalysisRows(rows, ['In-Person', 'Hybrid'], { aggregationMode: 'average', focusTerm: 'FALL 2027', definition });
  const totalRows = COSEnrollmentAnalytics.primeTimeAnalysisRows(rows, ['In-Person', 'Hybrid'], { aggregationMode: 'total', focusTerm: 'FALL 2027', definition });
  const offerings = averageRows.find(row => row.category === 'Scheduled Class Offerings, Unique CRNs');
  const meetings = totalRows.find(row => row.category === 'Instructional Meetings');
  const lab = totalRows.find(row => row.category === 'Lab');

  assert.equal(offerings.totalValue, 1);
  assert.equal(offerings.primeValue, 1);
  assert.equal(offerings.nonPrimeValue, 0);
  assert.equal(meetings.totalValue, 3);
  assert.equal(meetings.primeValue, 3);
  assert.equal(meetings.percentPrime, '100.0%');
  assert.equal(lab.totalValue, 1);
  assert.match(meetings.historicalTermWeights, /FALL 2026:1/);
  assert.equal(meetings.aggregationMode, 'Total Across Selected Terms');
});

test('instructor availability keeps Monday-only lab separate from MWF lecture', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    COSEnrollmentAnalytics.normalizeRow({
      Term: 'FALL 2027',
      CRN: '70001',
      Subject: 'BIOL',
      Course: '001',
      Section: '01',
      Instructor: 'DOE, J',
      Days: 'MWF',
      Start_Time: '10:10',
      End_Time: '11:00'
    }),
    COSEnrollmentAnalytics.normalizeRow({
      Term: 'FALL 2027',
      CRN: '70001',
      Subject: 'BIOL',
      Course: '001',
      Section: '01',
      Instructor: 'DOE, J',
      Days: 'M',
      Start_Time: '13:10',
      End_Time: '19:00'
    })
  ];
  const scheduleRows = COSEnrollmentAnalytics.instructorScheduleRows(rows);

  assert.equal(scheduleRows.length, 2);
  assert.equal(JSON.stringify(scheduleRows.map(row => `${row.dayPattern} ${row.start}-${row.end}`).sort()), JSON.stringify([
    'M 13:10-19:00',
    'MWF 10:10-11:00'
  ]));
});

test('TIMBER report organization moves analytics tools into enrollment management', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  const reportOrderStart = text.indexOf('const REPORT_ORDER = [');
  const reportOrderEnd = text.indexOf('];', reportOrderStart);
  const reportOrderBlock = text.slice(reportOrderStart, reportOrderEnd);

  assert.match(text, /const REPORT_WORKFLOW_GROUPS = \[/);
  assert.match(text, /label: 'Dean \/ Schedule Analysis'/);
  assert.match(text, /label: 'Enrollment Management'/);
  assert.match(text, /label: 'Development'/);
  assert.match(text, /label: 'Admin'/);
  assert.match(text, /function reportGroupsHtml/);
  assert.match(text, /const REPORT_GROUP_SUBTITLES = \{/);
  assert.match(text, /'schedule-analysis': 'Primary Audience: Dean \/ Division Chair'/);
  assert.match(text, /'enrollment-management': 'Primary Audience: Enrollment Management'/);
  assert.match(text, /development: 'Status: In Development'/);
  assert.match(text, /admin: 'Primary Audience: Administrator'/);
  assert.match(text, /function reportSubtitleForGroup/);
  assert.match(text, /function reportSubtitleForReport/);
  assert.match(text, /class="em-report-groups"/);
  assert.match(text, /class="em-report-button"/);
  assert.match(text, /data-report-role="\$\{group\.key\}"/);
  assert.match(text, /data-report-group="\$\{group\.key\}"/);
  assert.match(text, /data-required-role="\$\{REPORT_ACCESS\[report\] \|\| 'general'\}"/);
  assert.match(text, /<small>\$\{escapeAttr\(subtitle\)\}<\/small>/);
  assert.match(text, /id="emReportSelect" hidden/);
  [
    'REPORTS.heatmap',
    'REPORTS.duration',
    'REPORTS.studentPresence',
    'REPORTS.utilization',
    'REPORTS.roomFit',
    'REPORTS.modality',
    'REPORTS.instructorAvailability',
    'REPORTS.dashboard',
    'REPORTS.attrition',
    'REPORTS.demand',
    'REPORTS.consolidation',
    'REPORTS.conflictCheck',
    'REPORTS.facultyHeatmap',
    'REPORTS.facultyModality',
    'REPORTS.primeTimeAnalysis',
    'REPORTS.supplyDemand',
    'REPORTS.studentChoiceOpportunity',
    'REPORTS.busyTimeDashboard',
    'REPORTS.recommendationEngine',
    'REPORTS.scheduleOptimizationLab',
    'REPORTS.instructionalMethodValidation',
    'REPORTS.archiveInspection',
    'REPORTS.snapshotManager',
    'REPORTS.workExperience'
  ].reduce((lastIndex, report) => {
    const indexOfReport = reportOrderBlock.indexOf(report);
    assert.ok(indexOfReport > lastIndex, `${report} should appear in grouped report order`);
    return indexOfReport;
  }, -1);

  assert.doesNotMatch(index, /<option value="heatmap">/);
  assert.doesNotMatch(index, /<option value="modality">/);
  assert.doesNotMatch(index, /<option value="linechart">/);
  assert.match(text, /document\.getElementById\('analyticsReports'\)\.appendChild\(tool\)/);
  assert.match(text, /roomFitReport/);
  assert.match(index, /heatmap-archive-terms/);
  assert.match(index, /heatmap-source-status/);
  assert.match(index, /modality-archive-terms/);
  assert.match(index, /linechart-archive-terms/);
  assert.match(index, /linechart-source-status/);
  assert.match(text, /roomFitArchiveTerms/);
  assert.match(app, /renderRoomFitReport/);
  assert.match(app, /function setScheduleAnalysisStatus/);
  assert.match(app, /Choose a CSV or archived term, then click Load Source/);
  assert.match(app, /Loaded \$\{rows\.length\} row\(s\)/);
  assert.match(app, /parseHour\(row\[5\]\?\.split/);
  assert.match(app, /r\.Days \|\| r\.days \|\| r\.dayPattern/);
  assert.match(app, /'roomOnly', 'room'/);
  assert.match(app, /'Start_Time', 'Start Time', 'start', 'Start'/);
  assert.match(app, /dayColumnMap/);
  assert.match(app, /'MONDAY', 'Monday'/);
  assert.match(app, /'INSTRUCTIONAL_METHOD_CODE'/);
  assert.match(app, /Underutilized Room/);
  assert.match(app, /Over Capacity Risk/);
  assert.match(app, /Enrollment Exceeds Room Capacity/);
  assert.match(text, /#roomFitReportMetrics button\.room-fit-card/);
  assert.match(text, /#roomFitReportMetrics button\.room-fit-card\.is-active/);
  assert.match(text, /#f59e0b/);
  assert.match(app, /requestPassword/);
  assert.doesNotMatch(app, /prompt\(/);
  assert.doesNotMatch(text, /prompt\(/);
  assert.match(text, /type="password"/);
  assert.match(css, /password-eye/);
  assert.match(text, /defaultCampusCodes = \['COS', 'TCC', 'HAC', 'ONT', 'ONH', 'ONC'\]/);
  assert.match(text, /physicalCampusCodes = \['COS', 'TCC', 'HAC'\]/);
});

test('report tiles use standardized category subtitles without changing navigation targets', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  [
    ["'schedule-analysis'", "'Primary Audience: Dean / Division Chair'"],
    ["'enrollment-management'", "'Primary Audience: Enrollment Management'"],
    ['development', "'Status: In Development'"],
    ['admin', "'Primary Audience: Administrator'"]
  ].forEach(([key, subtitle]) => {
    assert.ok(text.includes(`${key}: ${subtitle}`), `${key} should map to ${subtitle}`);
  });
  assert.match(text, /const subtitle = reportSubtitleForGroup\(group\.key\)/);
  assert.match(text, /data-report-target="\$\{report\}"/);
  assert.match(text, /data-report-group="\$\{group\.key\}"/);
  assert.match(text, /<small>\$\{escapeAttr\(subtitle\)\}<\/small>/);
  assert.match(text, /note\.textContent = reportSubtitleForGroup\(button\.dataset\.reportGroup\) \|\| reportSubtitleForReport\(report\)/);
  assert.doesNotMatch(text, /<small>\$\{canAccess\(report\)/);
  assert.doesNotMatch(text, /Locked - unlock to view name/);
});

test('TIMBER role-based access is centralized and report scoped', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '..', '..', 'App-Backend', 'server.js'), 'utf8');

  assert.match(text, /const ROLE_LEVEL = \{/);
  assert.match(text, /development: 4/);
  assert.match(text, /const REPORT_ACCESS = \{/);
  assert.match(text, /\[REPORTS\.dashboard\]: 'dean'/);
  assert.match(text, /\[REPORTS\.modality\]: 'dean'/);
  assert.match(text, /\[REPORTS\.consolidation\]: 'em'/);
  assert.match(text, /\[REPORTS\.archiveInspection\]: 'admin'/);
  assert.match(text, /\[REPORTS\.snapshotManager\]: 'admin'/);
  assert.match(text, /\[REPORTS\.workExperience\]: 'admin'/);
  assert.match(text, /\[REPORTS\.instructionalMethodValidation\]: 'admin'/);
  assert.match(text, /function canAccess\(reportName\)/);
  assert.match(text, /Access Level/);
  assert.match(text, /id="currentAccessLevel"/);
  assert.match(text, /Lock Reports/);
  assert.match(text, /function lockedReportLabel/);
  assert.match(text, /Locked report ••••••••/);
  assert.doesNotMatch(text, /Locked - unlock to view name/);
  assert.match(text, /note\.textContent = reportSubtitleForGroup\(button\.dataset\.reportGroup\) \|\| reportSubtitleForReport\(report\)/);
  assert.match(text, /the selected locked report/);
  assert.match(text, /A locked report requires/);
  assert.doesNotMatch(text, /\[Locked\] \$\{escapeAttr\(REPORT_LABEL/);
  assert.match(text, /data-unlock-report/);
  assert.match(text, /api\/auth\/role/);
  assert.match(text, /General supports file upload and maintenance passwords only/);
  assert.match(text, /Administrator is reserved for system configuration, archive inspection, snapshot management, Work Experience uploads/);
  assert.match(text, /Development is for experimental and in-progress reports/);
  assert.doesNotMatch(text, /Developer/);
  assert.doesNotMatch(text, /Upload2025/);
  assert.match(backend, /GENERAL_PASSWORD/);
  assert.match(backend, /DEAN_PASSWORD/);
  assert.match(backend, /EM_PASSWORD/);
  assert.match(backend, /DEV_PASSWORD/);
  assert.match(backend, /ADMIN_PASSWORD/);
  assert.match(backend, /app\.post\('\/api\/auth\/role'/);
});

test('data validation and mapping report is an Admin diagnostic', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const developmentBlock = app.slice(app.indexOf("key: 'development'"), app.indexOf("key: 'admin'"));
  const adminBlock = app.slice(app.indexOf("key: 'admin'"), app.indexOf('const SNAPSHOT_STORAGE_KEY'));

  assert.match(app, /instructionalMethodValidation: 'instructional-method-validation'/);
  assert.match(app, /\[REPORTS\.instructionalMethodValidation\]: 'admin'/);
  assert.match(app, /\[REPORTS\.instructionalMethodValidation\]: 'Data Validation & Mapping'/);
  assert.match(adminBlock, /REPORTS\.instructionalMethodValidation/);
  assert.doesNotMatch(developmentBlock, /REPORTS\.instructionalMethodValidation/);
  assert.match(app, /<h2>Data Validation &amp; Mapping<\/h2>/);
  assert.match(app, /Admin diagnostic for reviewing instructional method mappings, faculty type mappings, and meeting type mappings/);
  assert.match(app, /This view is read-only for mappings/);
  assert.match(app, /Faculty Type Mapping/);
  assert.match(app, /FCNT_CODE mapping: FT and TE are Full-Time, JP is Part-Time, AE and X are omitted/);
  assert.match(app, /Meeting Type Mapping/);
  assert.match(app, /SCHD_CODE_SSRMEET mapping: 2 is Lecture, 4 is Lab, XX is Activity/);
  assert.match(app, /id="instructionalMethodValidationReport"/);
  assert.match(app, /id="instructionalMethodValidationCsv"/);
  assert.match(app, /id="instructionalMethodValidationArchiveTerms"/);
  assert.match(app, /id="runInstructionalMethodValidation"/);
  assert.match(app, /id="exportInstructionalMethodValidation"/);
  assert.match(app, /setReportDisplay\(REPORTS\.instructionalMethodValidation, 'instructionalMethodValidationReport'\)/);
  assert.match(app, /instructional-method-validation\.csv/);
});

test('backend keeps faculty schedule archives isolated from section schedule storage', () => {
  const backend = fs.readFileSync(path.join(__dirname, '..', '..', 'App-Backend', 'server.js'), 'utf8');

  assert.match(backend, /FACULTY_SCHEDULES_DIR = path\.join\(DATA_DIR, 'faculty-schedules'\)/);
  assert.match(backend, /function getFacultySchedulePath\(term\)/);
  assert.match(backend, /app\.get\('\/api\/faculty-schedules'/);
  assert.match(backend, /app\.get\('\/api\/faculty-schedules\/:term'/);
  assert.match(backend, /app\.post\('\/api\/faculty-schedules\/:term'/);
  assert.match(backend, /app\.delete\('\/api\/faculty-schedules\/:term'/);
  assert.match(backend, /validateFacultyScheduleRows/);
  assert.match(backend, /FCNT_CODE/);
  assert.match(backend, /FACULTYID/);
  assert.match(backend, /SCHD_CODE_SSRMEET/);
  assert.match(backend, /facultyScheduleMetadata/);
  assert.match(backend, /rawRowCount/);
  assert.match(backend, /normalizedMeetingCount/);
  assert.match(backend, /omittedRowCount/);
  assert.match(backend, /distinctFacultyCount/);
  assert.match(backend, /distinctCrnCount/);
  assert.match(backend, /facultyTypeCounts/);
  assert.match(backend, /meetingTypeCounts/);
  assert.match(backend, /isEnrollmentSessionAuthorized\(req\) && !isAuthorized\(password\)/);
  const pathHelper = backend.slice(backend.indexOf('function getFacultySchedulePath'), backend.indexOf('function passwordMatches'));
  assert.match(pathHelper, /FACULTY_SCHEDULES_DIR/);
  assert.doesNotMatch(pathHelper, /ANALYTICS_ARCHIVE_DIR/);
  assert.doesNotMatch(pathHelper, /getSchedulePath/);
});

test('faculty schedule heatmap is a standalone Development report', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /facultyHeatmap: 'faculty-schedule-heatmap'/);
  assert.match(text, /\[REPORTS\.facultyHeatmap\]: 'development'/);
  assert.match(text, /Faculty Schedule Heatmap/);
  assert.match(text, /id="facultyHeatmapReport"/);
  assert.match(text, /id="facultyScheduleCsv"/);
  assert.match(text, /id="saveFacultyScheduleArchive"/);
  assert.match(text, /id="facultyScheduleArchiveTerm"/);
  assert.match(text, /id="loadSavedFacultyScheduleHeatmap"/);
  assert.match(text, /id="facultyScheduleArchiveStatus"/);
  assert.match(text, /id="fhMetric"/);
  assert.match(text, /<option value="sections">Sections<\/option>/);
  assert.match(text, /<option value="facultyCount">Faculty Count<\/option>/);
  assert.match(text, /<option value="enrollment">Enrollment<\/option>/);
  assert.match(text, /<option value="seats">Seats<\/option>/);
  assert.match(text, /<option value="lhe">LHE<\/option>/);
  assert.doesNotMatch(text, /id="fhFacultyType"/);
  assert.match(text, /id="fhMeetingType"/);
  assert.match(text, /Lecture/);
  assert.match(text, /Lab/);
  assert.match(text, /Activity/);
  assert.match(text, /id="fhCampus"/);
  assert.match(text, /id="fhDivision"/);
  assert.match(text, /id="fhDepartment"/);
  assert.match(text, /id="fhSubject"/);
  assert.match(text, /id="fhCourse"/);
  assert.match(text, /id="fhTerm"/);
  assert.match(text, /id="fhModality"/);
  assert.match(text, /id="facultyHeatmapComparisonTable"/);
  assert.match(text, /function readFacultyScheduleFiles/);
  assert.match(text, /COSFacultyParser\.parseFacultyScheduleCsv/);
  assert.match(text, /function saveFacultyScheduleArchive/);
  assert.match(text, /function refreshFacultyScheduleArchives/);
  assert.match(text, /function readSavedFacultyScheduleRows/);
  assert.match(text, /state\.facultyScheduleArchiveTerms/);
  assert.match(text, /state\.facultyScheduleRows/);
  assert.match(text, /state\.facultyScheduleMetadata/);
  assert.match(text, /api\/faculty-schedules/);
  assert.match(text, /This does not appear to be a Faculty Schedule file/);
  assert.match(text, /Faculty Schedule Data is a separate optional dataset/);
  assert.match(text, /function renderFacultyScheduleHeatmap/);
  assert.match(text, /heatmap-cell heatmap-value-cell heatmap-\$\{level\}/);
  assert.match(text, /facultyFilterSourceRows\(\{ includeFacultyType: false \}\)/);
  assert.match(text, /Faculty Schedule Heatmap \(All Faculty\)/);
  assert.match(text, /Faculty Schedule Heatmap \(Full-Time Faculty\)/);
  assert.match(text, /Faculty Schedule Heatmap \(Part-Time Faculty\)/);
  assert.match(text, /facultyHeatmapOverall/);
  assert.match(text, /facultyHeatmapFullTime/);
  assert.match(text, /facultyHeatmapPartTime/);
  assert.match(text, /facultyHeatmapPanelSummaryHtml/);
  assert.match(text, /facultyHeatmapPanelDetailTableHtml/);
  assert.match(text, /Heatmap Detail Data/);
  assert.match(text, /data-collapsible-title="Heatmap Detail Data"/);
  assert.match(text, /data-collapsible-default-open="false"/);
  assert.match(text, /heatmapDay: row\.dayName/);
  assert.match(text, /heatmapTime: row\.time/);
  assert.match(text, /heatmapDay: 'Day'/);
  assert.match(text, /heatmapTime: 'Time'/);
  assert.match(text, /facultyHeatmapPanelMethodologyHtml/);
  assert.match(text, /data-collapsible-default-open="true"/);
  assert.doesNotMatch(text, /selector: '#facultyHeatmapContainer'/);
  assert.doesNotMatch(text, /selector: '#facultyHeatmapMetrics'/);
  assert.doesNotMatch(text, /selector: '#facultyHeatmapTable'/);
  assert.doesNotMatch(text, /selector: '#facultyHeatmapLegend'/);
  assert.doesNotMatch(text, /table\('facultyHeatmapTable'/);
  assert.match(text, /const sharedSlots = facultyHeatmapSlots\(overallRows/);
  assert.match(text, /const maxValue = Math\.max\(0, \.\.\.\[builtOverall, builtFullTime, builtPartTime\]/);
  assert.match(text, /function facultyHeatmapComparisonRows/);
  assert.match(text, /table\('facultyHeatmapComparisonTable', facultyHeatmapComparisonRows\(panels\), \['metric', 'overall', 'fullTime', 'partTime'\]\)/);
  assert.match(text, /Peak Concurrent Faculty/);
  assert.match(text, /Average Concurrent Faculty/);
  assert.match(text, /Peak Instructional Meetings/);
  assert.match(text, /function attachFacultyHeatmapHoverSync/);
  assert.match(text, /data-faculty-heatmap-key/);
  assert.match(text, /faculty-heatmap-linked-cell/);
  assert.match(text, /function facultyHeatmapComparisonTooltip/);
  assert.match(text, /\['Overall', `\$\{valueFor\(cellGroup\?\.overall\)\}/);
  assert.match(text, /\['Full-Time', `\$\{valueFor\(cellGroup\?\.fullTime\)\}/);
  assert.match(text, /\['Part-Time', `\$\{valueFor\(cellGroup\?\.partTime\)\}/);
  assert.match(text, /function renderFacultyHeatmapCombinedExportMenu/);
  assert.match(text, /Export Overall Heatmap/);
  assert.match(text, /Export Full-Time Heatmap/);
  assert.match(text, /Export Part-Time Heatmap/);
  assert.match(text, /Export All Three Heatmaps/);
  assert.match(text, /Faculty Schedule Heatmaps - All Faculty, Full-Time Faculty, and Part-Time Faculty/);
  assert.match(text, /id="facultyHeatmapDistributionChart"/);
  assert.match(text, /id="facultyHeatmapRatioHeatmap"/);
  assert.match(text, /function facultyHeatmapDistributionRows/);
  assert.match(text, /const total = ftValue \+ ptValue/);
  assert.match(text, /ftShare: total \? ftValue \/ total : null/);
  assert.match(text, /ptShare: total \? ptValue \/ total : null/);
  assert.match(text, /function renderFacultyHeatmapDistributionChart/);
  assert.match(text, /FT\/PT Distribution Stacked Area Chart/);
  assert.match(text, /Monday through Thursday aggregate/);
  assert.match(text, /Full-Time count/);
  assert.match(text, /Part-Time count/);
  assert.match(text, /FT share/);
  assert.match(text, /PT share/);
  assert.match(text, /function facultyHeatmapRatioRows/);
  assert.match(text, /const ftPercent = total \? ftValue \/ total \* 100 : null/);
  assert.match(text, /const ptPercent = total \? ptValue \/ total \* 100 : null/);
  assert.match(text, /!total \? 'No activity'/);
  assert.match(text, /function renderFacultyHeatmapRatioHeatmap/);
  assert.match(text, /FT\/PT Ratio Heatmap/);
  assert.match(text, /data-collapsible-id="faculty-heatmap-ratio-heatmap" data-collapsible-default-open="false"/);
  assert.match(text, /row\?\.total \? `\$\{Math\.round\(row\.ftPercent\)\}% FT` : ''/);
  assert.match(text, /Mostly Full-Time/);
  assert.match(text, /Balanced/);
  assert.match(text, /Mostly Part-Time/);
  assert.match(text, /Separate ratio legend/);
  assert.match(text, /faculty-heatmap-ft-pt-distribution\.png/);
  assert.match(text, /faculty-heatmap-ft-pt-ratio\.png/);
  assert.match(text, /term: options\.term/);
  assert.match(text, /filters: options\.filters/);
  assert.match(text, /panels\.forEach\(panel => attachHeatmapExportToolbar\(panel\.id/);
  assert.match(text, /FacultyScheduleHeatmap_\$\{panel\.exportSlug\}\.png/);
  assert.match(text, /FacultyScheduleHeatmap_\$\{panel\.exportSlug\}\.csv/);
  assert.match(text, /FacultyScheduleHeatmap_\$\{panel\.exportSlug\}\.pdf/);
  assert.match(text, /FacultyScheduleHeatmap_\$\{exportSlug\}\.png/);
  assert.match(text, /facultyGroup: panel\.groupLabel/);
  assert.match(text, /Faculty Scheduled/);
  assert.match(text, /Meeting Rows Included/);
  assert.match(text, /Instructional Meetings/);
  assert.match(text, /Enrollment Supported/);
  assert.match(text, /Seats Supported/);
  assert.match(text, /Peak Time/);
  assert.match(text, /Peak Value/);
});

test('faculty modality is a standalone Development report using INSM codes', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /facultyModality: 'faculty-modality'/);
  assert.match(text, /\[REPORTS\.facultyModality\]: 'development'/);
  assert.match(text, /Faculty Modality/);
  assert.match(text, /id="facultyModalityReport"/);
  assert.match(text, /id="facultyModalityCsv"/);
  assert.match(text, /id="facultyModalityArchiveTerm"/);
  assert.match(text, /id="loadSavedFacultyModality"/);
  assert.match(text, /function loadSavedFacultyModality/);
  assert.match(text, /id="fmCampus"/);
  assert.match(text, /id="fmDivision"/);
  assert.match(text, /id="fmDepartment"/);
  assert.match(text, /id="fmCourse"/);
  assert.match(text, /id="fmTerm"/);
  assert.match(text, /id="exportFacultyModality"/);
  assert.match(text, /function facultyInstructionModality/);
  assert.match(text, /row\?\.insmCode/);
  assert.match(text, /normalizeModality\(row\?\.insmCode/);
  assert.match(text, /Full-Time/);
  assert.match(text, /Part-Time/);
  assert.match(text, /Unknown/);
  assert.match(text, /In-Person/);
  assert.match(text, /Hybrid/);
  assert.match(text, /Online/);
  assert.doesNotMatch(text, /Other modality buckets/);
  assert.match(text, /FT\/PT Share of Class Offerings/);
  assert.match(text, /Full-Time Modality Share/);
  assert.match(text, /Part-Time Modality Share/);
  assert.match(text, /function renderFacultyModalityPieCard/);
  assert.match(text, /faculty-modality-pie-grid/);
  assert.match(text, /faculty-modality-pie-card/);
  assert.match(text, /faculty-modality-bar/);
  assert.match(text, /facultyModalityTableRows/);
  assert.match(text, /faculty-modality\.csv/);
  assert.match(text, /INSM_CODE_SSBSECT/);
});

test('prime time analysis is a standalone Development report with custom definition controls', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /primeTimeAnalysis: 'prime-time-analysis'/);
  assert.match(text, /\[REPORTS\.primeTimeAnalysis\]: 'development'/);
  assert.match(text, /Prime Time Analysis/);
  assert.match(text, /Prime Time Analysis defaults to physical instruction because it is intended to evaluate campus time-of-day concentration\. Online sections can be included manually\./);
  assert.match(text, /id="primeTimeAnalysisReport"/);
  assert.match(text, /id="primeTimeCsv"/);
  assert.match(text, /id="primeTimeArchiveTerm"/);
  assert.match(text, /id="loadSavedPrimeTimeAnalysis"/);
  assert.match(text, /function loadSavedPrimeTimeAnalysis/);
  assert.match(text, /id="ptStart" type="time" value="09:00"/);
  assert.match(text, /id="ptEnd" type="time" value="15:00"/);
  assert.match(text, /class="ptDay" type="checkbox" value="MO" checked/);
  assert.match(text, /class="ptDay" type="checkbox" value="TH" checked/);
  assert.match(text, /id="ptCampus"/);
  assert.match(text, /id="ptDivision"/);
  assert.match(text, /id="ptDepartment"/);
  assert.match(text, /id="ptCourse"/);
  assert.match(text, /id="ptTerm"/);
  assert.match(text, /id="ptTerm" multiple size="5"/);
  assert.match(text, /data-prime-time-terms="all"/);
  assert.match(text, /data-prime-time-terms="latest"/);
  assert.match(text, /id="ptHistoricalAggregation"/);
  assert.match(text, /Average per Selected Term/);
  assert.match(text, /Total Across Selected Terms/);
  assert.match(text, /Most Recent Comparable Term/);
  assert.match(text, /Weighted Historical Average/);
  assert.match(text, /id="ptModality" multiple size="3"/);
  assert.match(text, /data-modality-quick="ptModality" data-modality-values="In-Person\|Hybrid"/);
  assert.match(text, /data-modality-quick="ptModality" data-modality-values="In-Person\|Hybrid\|Online"/);
  assert.match(text, /id="exportPrimeTimeAnalysis"/);
  assert.match(text, /function primeTimeDefinition/);
  assert.match(text, /function rowOverlapsPrimeTime/);
  assert.match(text, /function primeTimeSelectedTerms/);
  assert.match(text, /function primeTimeScopeDiagnostics/);
  assert.match(text, /function primeTimeAnalysisRows/);
  assert.match(text, /Online async\/TBA rows excluded/);
  assert.match(text, /only online rows with real scheduled days and start\/end times/);
  assert.match(text, /Scheduled Class Offerings, Unique CRNs/);
  assert.match(text, /Instructional Meetings/);
  assert.match(text, /Full-Time Faculty Instructional Meetings/);
  assert.match(text, /Part-Time Faculty Instructional Meetings/);
  assert.match(text, /Lecture/);
  assert.match(text, /Lab/);
  assert.match(text, /Activity/);
  assert.match(text, /Enrollment/);
  assert.match(text, /Non-Prime/);
  assert.match(text, /Summer terms are weighted lower when planning Fall or Spring/);
  assert.match(text, /LHE/);
  assert.match(text, /prime-time-gauge/);
  assert.match(text, /prime-time-analysis\.csv/);
});

test('supply vs demand is a standalone Development report with heatmap line and table views', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /supplyDemand: 'supply-demand-analysis'/);
  assert.match(text, /\[REPORTS\.supplyDemand\]: 'development'/);
  assert.match(text, /Supply vs Demand/);
  assert.match(text, /id="supplyDemandReport"/);
  assert.match(text, /id="supplyDemandCsv"/);
  assert.match(text, /id="sdArchiveTerms"/);
  assert.match(text, /id="sdView"/);
  assert.match(text, /id="sdMetric"/);
  assert.match(text, /Sections/);
  assert.match(text, /Seats Offered/);
  assert.match(text, /Student Presence/);
  assert.match(text, /Fill Rate/);
  assert.match(text, /Waitlist/);
  assert.match(text, /Empty Seats/);
  assert.match(text, /id="sdCampus"/);
  assert.match(text, /id="sdDivision"/);
  assert.match(text, /id="sdDepartment"/);
  assert.match(text, /id="sdCourse"/);
  assert.match(text, /id="sdCalGetc"/);
  assert.match(text, /id="sdModality"/);
  assert.match(text, /id="sdPlanningWindow"/);
  assert.match(text, /Standard planning window/);
  assert.match(text, /Saturday\/Sunday excluded/);
  assert.match(text, /function runSupplyDemand/);
  assert.match(text, /function buildSupplyDemandBuckets/);
  assert.match(text, /function supplyDemandRowStartsInPlanningWindow/);
  assert.match(text, /function renderSupplyDemandHeatmap/);
  assert.match(text, /function renderSupplyDemandLineGraph/);
  assert.match(text, /High Demand/);
  assert.match(text, /Hidden Demand/);
  assert.match(text, /Balanced/);
  assert.match(text, /Oversupplied/);
  assert.match(text, /Low Activity/);
  assert.match(text, /enrollment alone cannot prove student preference/i);
  assert.match(text, /supply-vs-demand\.csv/);
});

test('busy time dashboard is a standalone Development report summarizing core busy-time signals', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /busyTimeDashboard: 'busy-time-dashboard'/);
  assert.match(text, /\[REPORTS\.busyTimeDashboard\]: 'development'/);
  assert.match(text, /Busy Time Dashboard/);
  assert.match(text, /id="busyTimeDashboardReport"/);
  assert.match(text, /id="busyTimeCsv"/);
  assert.match(text, /id="busyTimeArchiveTerms"/);
  assert.match(text, /id="busyTimeFacultyCsv"/);
  assert.match(text, /id="busyTimeFacultyArchiveTerm"/);
  assert.match(text, /id="loadSavedBusyTimeFaculty"/);
  assert.match(text, /function loadSavedBusyTimeFacultySchedule/);
  assert.match(text, /Prime Time Score/);
  assert.match(text, /Faculty Concentration/);
  assert.match(text, /Student Concentration/);
  assert.match(text, /Seat Supply/);
  assert.match(text, /Peak Choice Diversity Index/);
  assert.match(text, /choiceDiversityIndex/);
  assert.match(text, /Demand Pressure/);
  assert.match(text, /Room Utilization/);
  assert.match(text, /High enrollment appears to coincide with high section supply/);
  assert.match(text, /Evening sections have limited supply but consistently high fill/);
  assert.match(text, /Full-time faculty are concentrated between 9 AM and 2 PM/);
  assert.match(text, /Student demand remains strong after 4 PM/);
  assert.match(text, /summarizes data only and does not make scheduling recommendations/i);
  assert.match(text, /function runBusyTimeDashboard/);
  assert.match(text, /function buildBusyTimeBuckets/);
  assert.match(text, /function buildBusyTimeFacultyBuckets/);
  assert.match(text, /busy-time-dashboard\.csv/);
});

test('schedule opportunity analysis is a standalone Development report with planning and scenario modes', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /studentChoiceOpportunity: 'student-choice-opportunity'/);
  assert.match(text, /\[REPORTS\.studentChoiceOpportunity\]: 'development'/);
  assert.match(text, /Schedule Opportunity Analysis/);
  assert.match(text, /id="studentChoiceOpportunityReport"/);
  assert.match(text, /id="studentChoiceCsv"/);
  assert.match(text, /id="studentChoiceArchiveTerms"/);
  assert.match(text, /id="studentChoiceFacultyCsv"/);
  assert.match(text, /id="studentChoiceFacultyArchiveTerm"/);
  assert.match(text, /id="loadSavedStudentChoiceFaculty"/);
  assert.match(text, /function loadSavedStudentChoiceFacultySchedule/);
  assert.match(text, /Historical Evaluation/);
  assert.match(text, /Planning &amp; Forecast/);
  assert.match(text, /Scenario Analysis/);
  assert.match(text, /studentChoiceHistoricalTerms/);
  assert.match(text, /studentChoiceDemandSource/);
  assert.match(text, /studentChoiceScenarioAction/);
  assert.match(text, /Scheduled Class Offerings/);
  assert.match(text, /Projected Enrollment/);
  assert.match(text, /Historical Opportunity Gap/);
  assert.match(text, /id="studentChoiceHistoricalTable"/);
  assert.match(text, /Historical Comparison Table/);
  assert.match(text, /Scenario Before\/After Table/);
  assert.match(text, /No current enrollment yet/);
  assert.match(text, /Students can only enroll in sections that exist/);
  assert.match(text, /Unique courses/);
  assert.match(text, /Unique CAL-GETC courses/);
  assert.match(text, /Seats offered/);
  assert.match(text, /Enrollment present/);
  assert.match(text, /Fill rate/);
  assert.match(text, /Empty seats/);
  assert.match(text, /Course Choice Count/);
  assert.match(text, /GE Choice Count/);
  assert.match(text, /Subject Breadth Count/);
  assert.match(text, /Seat Choice Count/);
  assert.match(text, /Modality Choice Count/);
  assert.match(text, /Campus Choice Count/);
  assert.match(text, /Choice Diversity Index/);
  assert.match(text, /<option value="choiceDiversityIndex">Choice Diversity Index<\/option>/);
  assert.match(text, /choiceDiversityIndex/);
  assert.match(text, /High choice \/ high demand/);
  assert.match(text, /High choice \/ weaker demand/);
  assert.match(text, /Low choice \/ high demand/);
  assert.match(text, /Low choice \/ limited evidence/);
  assert.match(text, /Low choice \/ low demand/);
  assert.match(text, /studentChoiceExcludeTutoring/);
  assert.match(text, /isTutoringOpenLabSection\(row\)/);
  assert.match(text, /row\.timeBlock !== 'ONLINE\/TBA'/);
  assert.match(text, /sectionKey\(row\), day, row\.start, row\.end/);
  assert.match(text, /function buildStudentChoiceBuckets/);
  assert.match(text, /function renderStudentChoiceHeatmap/);
  assert.match(text, /function renderStudentChoiceLineGraph/);
  assert.match(text, /schedule-opportunity-analysis\.csv/);
});

test('choice diversity index rewards broad course choice over repeated sections', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const source = text.match(/function choiceDiversityIndex\([\s\S]*?\n  \}/)?.[0];
  assert.ok(source, 'choiceDiversityIndex helper should exist');
  const choiceDiversityIndex = new Function('safeDiv', `${source}; return choiceDiversityIndex;`)((a, b) => (b ? a / b : 0));

  const repeatedFewCourses = choiceDiversityIndex({
    uniqueCourses: 1,
    uniqueSubjects: 1,
    uniqueCalGetcCourses: 0,
    sections: 6,
    maxCourseSections: 6
  });
  const broadCourses = choiceDiversityIndex({
    uniqueCourses: 6,
    uniqueSubjects: 4,
    uniqueCalGetcCourses: 3,
    sections: 6,
    maxCourseSections: 1
  });

  assert.ok(repeatedFewCourses < broadCourses, `${repeatedFewCourses} should be lower than ${broadCourses}`);
});

test('schedule opportunity planning mode uses historical demand instead of labeling future zero enrollment as low demand', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    { Term: 'FALL 2027', CRN: '10001', Subject: 'MATH', Course: '021', Campus: 'COS', Capacity: '30', ACTUAL_ENROLL: '0', CENSUS_ENROLL: '0', Waitlist: '0', Days: 'MW', Start_Time: '09:00', End_Time: '10:30', 'Instructional Method': 'IP' },
    { Term: 'FALL 2027', CRN: '10001', Subject: 'MATH', Course: '021', Campus: 'COS', Capacity: '30', ACTUAL_ENROLL: '0', CENSUS_ENROLL: '0', Waitlist: '0', Days: 'MW', Start_Time: '09:00', End_Time: '10:30', 'Instructional Method': 'IP' },
    { Term: 'FALL 2026', CRN: '20001', Subject: 'MATH', Course: '021', Campus: 'COS', Capacity: '30', CENSUS_ENROLL: '27', Waitlist: '3', Days: 'MW', Start_Time: '09:00', End_Time: '10:30', 'Instructional Method': 'IP' },
    { Term: 'FALL 2025', CRN: '30001', Subject: 'MATH', Course: '021', Campus: 'COS', Capacity: '30', CENSUS_ENROLL: '24', Waitlist: '1', Days: 'MW', Start_Time: '09:00', End_Time: '10:30', 'Instructional Method': 'IP' }
  ].map(row => COSEnrollmentAnalytics.normalizeRow(row));
  const current = rows.filter(row => row.term === 'FALL 2027');
  const historical = rows.filter(row => row.term !== 'FALL 2027');

  assert.equal(COSEnrollmentAnalytics.scheduleOpportunityModeForRows(current), 'planning');
  const summary = COSEnrollmentAnalytics.scheduleOpportunitySummary(current);
  assert.equal(summary.scheduledClassOfferings, 1);
  assert.equal(summary.hasCurrentEnrollment, false);
  const projection = COSEnrollmentAnalytics.scheduleOpportunityHistoricalProjection(current, historical, 'average');
  assert.ok(projection.projectedEnrollment > 25.5);
  assert.equal(projection.forecastMethod, 'Trend Projection');
  assert.ok(projection.expectedRange.low < projection.expectedRange.mostLikely);
  assert.notEqual(COSEnrollmentAnalytics.scheduleOpportunityCategory(summary, projection, 'planning'), 'Low demand');
});

test('schedule opportunity weighted averages best match gaps and scenario outputs are calculated', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const make = (term, crn, enrollment, capacity = 30, start = '09:00', days = 'MW', modality = 'IP') => COSEnrollmentAnalytics.normalizeRow({
    Term: term,
    CRN: crn,
    Subject: 'ENGL',
    Course: '001',
    Campus: 'COS',
    Capacity: String(capacity),
    CENSUS_ENROLL: String(enrollment),
    Waitlist: enrollment >= capacity ? '2' : '0',
    Days: days,
    Start_Time: start,
    End_Time: start === '13:00' ? '14:30' : '10:30',
    'Instructional Method': modality
  });
  const current = [make('FALL 2027', '90001', 0), make('FALL 2027', '90002', 0, 25, '13:00')];
  const historical = [
    make('FALL 2022', '10001', 10),
    make('FALL 2023', '20001', 20),
    make('FALL 2024', '30001', 30),
    make('FALL 2025', '40001', 40),
    make('FALL 2026', '50001', 50)
  ];

  const weighted3 = COSEnrollmentAnalytics.scheduleOpportunityHistoricalProjection(current, historical, 'weighted3');
  const weighted5 = COSEnrollmentAnalytics.scheduleOpportunityHistoricalProjection(current, historical, 'weighted5');
  const best = COSEnrollmentAnalytics.scheduleOpportunityHistoricalProjection(current, historical, 'bestMatch');
  assert.equal(Math.round(weighted3.projectedEnrollment), 43);
  assert.equal(Math.round(weighted5.projectedEnrollment), 37);
  assert.equal(best.bestMatchTerm, 'FALL 2022');

  const gaps = COSEnrollmentAnalytics.scheduleOpportunityGapRows(current, historical, 'weighted3');
  assert.ok(gaps.some(row => row.metric === 'Scheduled Class Offerings' && row.opportunityGap === 1));
  assert.ok(gaps.some(row => row.metric === 'Enrollment Projection'));

  const removed = COSEnrollmentAnalytics.scheduleOpportunityScenarioRows(current, { action: 'remove', crns: ['90002'] });
  assert.equal(COSEnrollmentAnalytics.distinctScheduleSections(removed).length, 1);
  const shifted = COSEnrollmentAnalytics.scheduleOpportunityScenarioRows(current, { action: 'shiftPattern', crns: ['90001'], days: 'TR', start: '11:00', end: '12:30' });
  assert.equal(shifted.find(row => row.crn === '90001').dayPattern, 'TR');
  assert.equal(shifted.find(row => row.crn === '90001').start, '11:00');
  const comparison = COSEnrollmentAnalytics.scheduleOpportunityScenarioComparison(current, { action: 'remove', crns: ['90002'] }, historical, 'weighted3');
  assert.ok(comparison.some(row => row.metric === 'Scheduled Class Offerings' && row.before === 2 && row.after === 1));
  assert.ok(comparison.every(row => ['metric', 'before', 'after', 'change'].every(key => Object.hasOwn(row, key))));
});

test('scheduling recommendation engine is advisory and covers recommendation categories', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /recommendationEngine: 'scheduling-recommendation-engine'/);
  assert.match(text, /\[REPORTS\.recommendationEngine\]: 'development'/);
  assert.match(text, /Scheduling Recommendation Engine/);
  assert.match(text, /id="recommendationEngineReport"/);
  assert.match(text, /id="recommendationCsv"/);
  assert.match(text, /id="recommendationArchiveTerms"/);
  assert.match(text, /id="recommendationFacultyCsv"/);
  assert.match(text, /id="recommendationFacultyArchiveTerm"/);
  assert.match(text, /id="loadSavedRecommendationFaculty"/);
  assert.match(text, /function loadSavedRecommendationFacultySchedule/);
  assert.match(text, /id="recommendationStartEarliest" type="time" value="07:00"/);
  assert.match(text, /id="recommendationStartLatest" type="time" value="19:00"/);
  assert.match(text, /advisory-only/);
  assert.match(text, /does not automatically change schedules/);
  assert.match(text, /does not claim to prove student preference/);
  assert.match(text, /Hidden Demand/);
  assert.match(text, /Oversupply/);
  assert.match(text, /Choice Gap/);
  assert.match(text, /Faculty Concentration/);
  assert.match(text, /Room Opportunity/);
  assert.match(text, /Modality Imbalance/);
  assert.match(text, /Consolidation Candidate/);
  assert.match(text, /Expansion Candidate/);
  assert.match(text, /Insufficient evidence/);
  assert.match(text, /function recommendationConfidence/);
  assert.match(text, /High/);
  assert.match(text, /Medium/);
  assert.match(text, /Low/);
  assert.match(text, /observed enrollment/);
  assert.match(text, /available supply/);
  assert.match(text, /student choice opportunity/);
  assert.match(text, /faculty assignment pattern/);
  assert.match(text, /room availability/);
  assert.match(text, /Outside planning window diagnostics/);
  assert.match(text, /Candidates outside that window are suppressed from active recommendations/);
  assert.match(text, /recommendationTitle/);
  assert.match(text, /confidenceLevel/);
  assert.match(text, /affectedTermSource/);
  assert.match(text, /evidenceSummary/);
  assert.match(text, /metricsUsed/);
  assert.match(text, /whyThisMatters/);
  assert.match(text, /suggestedAction/);
  assert.match(text, /cautionsLimitations/);
  assert.match(text, /scheduling-recommendations\.csv/);
  assert.match(text, /scheduling-recommendations\.pdf/);
});

test('development reports use multi-select modality filters with quick-select controls', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const modalityIds = [
    'fhModality',
    'fmModality',
    'ptModality',
    'sdModality',
    'busyTimeModality',
    'studentChoiceModality',
    'recommendationModality'
  ];

  modalityIds.forEach(id => {
    assert.match(text, new RegExp(`id="${id}" multiple size="3"`));
    assert.match(text, new RegExp(`data-modality-quick="${id}" data-modality-values="In-Person\\|Hybrid"`));
    assert.match(text, new RegExp(`data-modality-quick="${id}" data-modality-values="In-Person\\|Hybrid\\|Online"`));
  });
  assert.match(text, /const PHYSICAL_MODALITY_LABELS = \['In-Person', 'Hybrid'\]/);
  assert.match(text, /const REPORTABLE_MODALITY_LABELS = \['In-Person', 'Hybrid', 'Online'\]/);
  assert.match(text, /function setModalitySelectOptions/);
  assert.match(text, /function rowMatchesSelectedModality/);
  assert.match(text, /function facultyMatchesSelectedModality/);
});

test('enrollment analytics supports supplemental work experience upload controls', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /Work Experience Enrollment Upload/);
  assert.match(text, /id="workExperienceCsv"/);
  assert.match(text, /session only until archive support is added/);
  assert.match(text, /dashIncludeWorkExperience/);
  assert.match(text, /attrIncludeWorkExperience/);
  assert.match(text, /demIncludeWorkExperience/);
  assert.match(text, /WORK EXPERIENCE/);
  assert.match(text, /FTES unavailable/);
  assert.match(text, /!row\.isWorkExperience/);
  assert.match(text, /dashboardSourceRows/);
  assert.match(text, /rowsWithWorkExperience/);
  assert.match(text, /studentPresence.*filter\(row => !row\.isWorkExperience\)/s);
});

test('snapshot manager defaults first day as primary manual snapshot', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const snapBlock = text.slice(text.indexOf('<select id="snapType">'), text.indexOf('</select>', text.indexOf('<select id="snapType">')));

  assert.ok(snapBlock.indexOf('<option>First Day</option>') < snapBlock.indexOf('<option>Census 1</option>'));
  assert.match(text, /First Day is the primary manual snapshot/);
  assert.match(text, /Census 1, Census 2, and Final are already present in Banner source exports/);
});

test('modality balance uses shared modality category normalization and diagnostics', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  assert.match(index, /modality-include-de/);
  assert.match(index, /Include Dual Enrollment in totals/);
  assert.match(index, /Dual Enrollment is shown as its own planning category/);
  ['modality-campus-select', 'modality-division-select', 'modality-discipline-select', 'modality-department-select', 'modality-course-select', 'modality-modality-select'].forEach(id => {
    assert.match(index, new RegExp(`id="${id}"[^>]*multiple`));
  });
  assert.match(index, /% of Class Offerings/);
  assert.match(index, /% of Enrollment/);
  assert.match(index, /Use the totals toggle to include or exclude Dual Enrollment from total\/share calculations/);
  assert.match(index, /modality-source-status/);
  assert.match(index, /modality-export-btn/);
  assert.match(index, /modality-export-excel-btn/);
  assert.match(index, /modality-course-comparison-table/);
  assert.match(index, /Course-Level Term Differences/);
  assert.match(app, /includeDualEnrollmentInTotals/);
  assert.match(app, /getModalityBalanceCategory/);
  assert.match(app, /isModalityDualEnrollmentSection/);
  assert.match(app, /COSModalityNormalizer\.normalize/);
  assert.match(app, /renderModalityDiagnostics/);
  assert.match(app, /Modality Filter Diagnostics/);
  assert.match(app, /Rows after Division filter/);
  assert.match(app, /rowsAfterDivisionFilter/);
  assert.match(app, /function filterMatchesAny/);
  assert.match(app, /function uniqueFilterOptions/);
  assert.match(app, /function modalityDivisionValue/);
  assert.match(app, /Unmapped Instructional Method Diagnostics/);
  assert.match(app, /isReportableModalityCategory/);
  assert.match(app, /loadModalityArchiveRowsFromBackend/);
  assert.match(app, /api\/analytics-archive/);
  assert.match(app, /let modalityLoadedSourceRows = null/);
  assert.match(app, /modalityLoadedSourceRows = modalityUploadRows/);
  assert.match(app, /return modalityLoadedSourceRows\?\.\length \? modalityLoadedSourceRows : currentData/);
  assert.match(app, /const terms = \[\.\.\.new Set\(rows\.map\(getSectionTerm\)/);
  assert.match(app, /function getModalityComparisonTerms/);
  assert.match(app, /function getModalityComparisonSourceRows/);
  assert.match(app, /const matchingSourceRows = sourceRows\.filter\(row => termMatches\(getSectionTerm\(row\), term\)\)/);
  assert.match(app, /return archiveRows;/);
  assert.match(app, /resetSelect\(select, comparisonTerms, 'None', ''\)/);
  assert.match(app, /calculateModalityBalance\(\{ term, sourceRows: getModalityComparisonSourceRows\(term\) \}\)/);
  assert.match(app, /const sourceRows = options\.sourceRows \|\| getModalitySourceRows\(\)/);
  assert.match(app, /selectedValues\(modalityCampusSelect\)/);
  assert.match(app, /selectedValues\(modalityCourseSelect\)/);
  assert.match(app, /selectedValues\(modalityModalitySelect\)/);
  assert.match(app, /function modalityFilteredSections/);
  assert.match(app, /function getModalitySectionIdentity/);
  assert.match(app, /function modalityCourseComparisonRows/);
  assert.match(app, /function renderModalityCourseComparisonTable/);
  assert.match(app, /function modalityCourseComparisonExportRows/);
  assert.match(app, /modalityPieCard\(`\$\{modalityTermLabel\(\)\} Class Offerings by Category`/);
  assert.match(app, /modalityPieCard\(`\$\{modalityTermLabel\(\)\} Enrollment by Category`/);
  assert.match(app, /modalityPieCard\(`\$\{modalityTermLabel\(\)\} Enrollment per Offering by Category`/);
  assert.match(app, /function modalityMixGraphData/);
  assert.match(app, /function modalityChartData/);
  assert.match(app, /className = 'modality-mix-bars'/);
  assert.doesNotMatch(app, /sections, \$\{Math\.round\(row\.share \* 100\)\}%; \$\{row\.enrollment\} enrollment/);
  assert.match(app, /function exportModalityBalance/);
  assert.match(app, /function exportModalityBalanceExcel/);
  assert.match(app, /modalityExportBtn\.addEventListener\('click', exportModalityBalance\)/);
  assert.match(app, /modalityExportExcelBtn\.addEventListener\('click', exportModalityBalanceExcel\)/);
  assert.match(app, /Graph Data/);
  assert.match(app, /Comparison Results/);
  assert.match(app, /Total Class Offerings Term Comparison/);
  assert.match(app, /Net Offerings vs/);
  assert.match(app, /All Included Categories/);
  assert.match(app, /modalityTotalClassOfferingComparisonRows/);
  assert.match(app, /modality-balance-\$\{slug\}\.csv/);
  assert.match(app, /modality-balance-\$\{slug\}\.xls/);
  assert.match(app, /Class Offerings by Category/);
  assert.match(app, /Enrollment by Category/);
  assert.match(app, /Enrollment per Offering by Category/);
  assert.match(app, /Course-Level Term Differences/);
  assert.match(app, /Focus term minus comparison term by Total Class Offerings \(unique CRN course\/modality grouping\)/);
  assert.match(app, /signedPctChange/);
  assert.match(app, /Current Loaded Term/);
  assert.match(app, /modalityBalanceTestHooks/);
  assert.match(app, /normalizeTermLabel\(canonical\.term\)/);
  assert.match(app, /CENSUS_ENROLL', 'Census_Enroll', 'Census Enroll', 'Census Enrollment', 'ACTUAL_ENROLL/);
});

test('schedule optimization lab is a standalone Development planning tool', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const moduleText = fs.readFileSync(path.join(__dirname, '..', 'js/core/schedule-optimization.js'), 'utf8');

  assert.match(index, /js\/core\/schedule-optimization\.js/);
  assert.match(text, /scheduleOptimizationLab: 'schedule-optimization-lab'/);
  assert.match(text, /\[REPORTS\.scheduleOptimizationLab\]: 'development'/);
  assert.match(text, /\[REPORTS\.scheduleOptimizationLab\]: 'Schedule Optimization Lab'/);
  assert.match(text, /id="scheduleOptimizationLabReport"/);
  assert.match(text, /Room priority behavior/);
  assert.match(text, /Advisory only/);
  assert.match(text, /Prefer priority match/);
  assert.match(text, /Strict priority match/);
  assert.match(text, /optimizationAllowCrossCampus/);
  assert.match(text, /Allow cross-campus recommendations/);
  assert.match(text, /Cross-campus recommendations/);
  assert.match(text, /Allowed time shift/);
  assert.match(text, /Maximum candidate rooms per section/);
  assert.match(text, /Run Optimization/);
  assert.match(text, /Clear Results/);
  assert.match(text, /optimizationRunStatus/);
  assert.match(text, /optimizationPerformanceDetails/);
  assert.match(text, /optimizationCsv/);
  assert.match(text, /optimizationArchiveTerms/);
  assert.match(text, /optimizationFacultyArchiveTerms/);
  assert.match(text, /refreshOptimizationArchives/);
  assert.match(text, /Backend archives:/);
  assert.match(text, /optimizationHistoryTerms/);
  assert.match(text, /optimizationDemandTerms/);
  assert.match(text, /Prior Fall Terms/);
  assert.match(text, /Prior Spring Terms/);
  assert.match(text, /Room Move Recommendations/);
  assert.match(text, /Time Shift Recommendations/);
  assert.match(text, /Add-a-Class Placement/);
  assert.match(text, /optimizationAddSubject/);
  assert.match(text, /optimizationAddCourseSelect/);
  assert.match(text, /optimizationAddSectionProfile/);
  assert.match(text, /Proposed Time Evaluation/);
  assert.match(text, /Better Times/);
  assert.match(text, /Room Priority Audit/);
  assert.match(text, /runScheduleOptimizationLab/);
  assert.match(text, /exportOptimizationRows/);
  assert.match(text, /setSelectOptions\('optimizationArchiveTerms', options\)/);
  assert.match(text, /'optimizationFacultyArchiveTerms'/);
  assert.match(text, /readSavedFacultyScheduleRowsForTerms/);
  assert.match(text, /loadOptimizationFacultyArchiveRows/);
  assert.match(text, /markOptimizationDirty/);
  assert.match(text, /invalidateOptimizationCache/);
  assert.match(text, /Build historical demand index/);
  assert.match(text, /Build room availability index/);
  assert.match(text, /Score room move recommendations/);
  assert.match(text, /Score time shift recommendations/);
  assert.match(text, /Score add-a-class recommendations/);
  assert.match(text, /function optimizationExclusionChips/);
  assert.match(text, /exclusions: optimizationExclusionChips\(exclusions\)/);
  assert.doesNotMatch(text, /exclusions: state\.optimizationContext\.exclusionReasons/);
  assert.doesNotMatch(text, /if \(state\.optimizationRan\) renderScheduleOptimizationLab/);
  assert.match(text, /setReportDisplay\(REPORTS\.scheduleOptimizationLab, 'scheduleOptimizationLabReport'\)/);
  assert.match(text, /optimization-room-move-recommendations/);
  assert.match(text, /optimization-room-priority-audit', title: 'Room Priority Audit', defaultOpen: false/);
  assert.match(moduleText, /function normalizeRoomPriority/);
  assert.match(moduleText, /function roomFitScore/);
  assert.match(moduleText, /function buildOptimizationIndexes/);
  assert.match(moduleText, /function buildAvailabilityIndex/);
  assert.match(moduleText, /function buildHistoricalDemandIndex/);
  assert.match(moduleText, /function candidateRoomsForSection/);
  assert.match(moduleText, /function generateRoomMoveRecommendations/);
  assert.match(moduleText, /SCHEDULE_TYPE_ROOM_COMPATIBILITY/);
  assert.match(moduleText, /SCHD 04\/4 sections require lab-compatible rooms/);
  assert.match(moduleText, /Cross-campus recommendation\. Administrative approval required\./);
  assert.doesNotMatch(moduleText, /campusFit/);
  assert.match(moduleText, /function generateTimeShiftRecommendations/);
  assert.match(moduleText, /function addClassPlacement/);
  assert.match(moduleText, /function courseProfiles/);
  assert.match(moduleText, /function evaluateProposedTime/);
  assert.match(moduleText, /function recommendBetterTimes/);
  assert.match(moduleText, /function roomPriorityAudit/);
  assert.match(moduleText, /Room too small for historical cap/);
  assert.match(moduleText, /behavior === 'strict'/);
});

test('modality balance counts unduplicated CRN offerings and census-first enrollment', () => {
  const hooks = loadScheduleAppRuntime();
  const rows = [
    { Term: 'FALL 2026', CRN: '10001', Subject: 'ART', Course: '101', 'Instructional Method': 'IP', CENSUS_ENROLL: '20', ACTUAL_ENROLL: '18' },
    { Term: 'FALL 2026', CRN: '10001', Subject: 'ART', Course: '101', 'Instructional Method': 'IP', CENSUS_ENROLL: '20', ACTUAL_ENROLL: '18', Days: 'W' },
    { Term: 'FALL 2026', CRN: '10002', Subject: 'MATH', Course: '100', 'Instructional Method': 'ONL', CENSUS_ENROLL: '', ACTUAL_ENROLL: '15' },
    { Term: 'FALL 2026', CRN: '10003', Subject: 'HIST', Course: '110', 'Instructional Method': 'HYB', CENSUS_ENROLL: '12', ACTUAL_ENROLL: '9' }
  ];
  const items = hooks.modalityBalanceItemsFromSections(rows);
  const summary = hooks.calculateModalityBalanceFromItems(items);
  const byModality = new Map(summary.map(row => [row.category, row]));

  assert.equal(byModality.get('In-Person').classOfferings, 1);
  assert.equal(byModality.get('In-Person').enrollment, 20);
  assert.equal(byModality.get('Online').classOfferings, 1);
  assert.equal(byModality.get('Online').enrollment, 15);
  assert.equal(byModality.get('Hybrid').classOfferings, 1);
  assert.equal(summary[0].totalClassOfferings, 3);
});

test('modality balance treats dual enrollment as distinct category with optional totals inclusion', () => {
  const hooks = loadScheduleAppRuntime();
  const rows = [
    { Term: 'FALL 2026', CRN: '20001', Subject: 'ENGL', Course: '001', 'Instructional Method': 'IP', 'Dual Enrollment': 'Yes', CENSUS_ENROLL: '25' },
    { Term: 'FALL 2026', CRN: '20002', Subject: 'HIST', Course: '020', 'Instructional Method': 'ONL', 'Dual Enrollment': 'Yes', CENSUS_ENROLL: '30' },
    { Term: 'FALL 2026', CRN: '20003', Subject: 'MATH', Course: '010', 'Instructional Method': 'ONL', CENSUS_ENROLL: '18' },
    { Term: 'FALL 2026', CRN: '20004', Subject: 'BIOL', Course: '011', 'Instructional Method': 'HYB', CENSUS_ENROLL: '22' }
  ];
  const includedItems = hooks.modalityBalanceItemsFromSections(rows, { includeDualEnrollmentInTotals: true });
  const excludedItems = hooks.modalityBalanceItemsFromSections(rows, { includeDualEnrollmentInTotals: false });
  const includedSummary = hooks.calculateModalityBalanceFromItems(includedItems);
  const excludedSummary = hooks.calculateModalityBalanceFromItems(excludedItems);
  const includedByCategory = new Map(includedSummary.map(row => [row.category, row]));
  const excludedByCategory = new Map(excludedSummary.map(row => [row.category, row]));

  assert.equal(includedByCategory.get('Dual Enrollment').classOfferings, 2);
  assert.equal(includedByCategory.get('Dual Enrollment').enrollment, 55);
  assert.equal(includedByCategory.get('In-Person').classOfferings, 0);
  assert.equal(includedByCategory.get('Online').classOfferings, 1);
  assert.equal(includedByCategory.get('Hybrid').classOfferings, 1);
  assert.equal(includedSummary[0].totalClassOfferings, 4);
  assert.equal(excludedSummary[0].totalClassOfferings, 2);
  assert.equal(excludedByCategory.get('Dual Enrollment').classOfferings, 2);
  assert.equal(excludedByCategory.get('Dual Enrollment').referenceOnly, true);
  assert.equal(excludedByCategory.get('Dual Enrollment').classOfferingShare, 0);

  const exportRows = hooks.modalityExportRowsForData(includedSummary, []);
  const dualExport = exportRows.find(row => row.ModalityBalanceCategory === 'Dual Enrollment' && row.Section === 'Focus Results');
  assert.equal(dualExport.DualEnrollmentFlag, 'Yes');
  assert.match(dualExport.UnderlyingInstructionalMethod, /IP \(1\)/);
  assert.match(dualExport.UnderlyingInstructionalMethod, /ONL \(1\)/);
  assert.equal(dualExport.Enrollment, 55);
  assert.equal(dualExport.EnrollmentPerOffering, '27.50');
});

test('room catalog import and export supports two optional room priority divisions', () => {
  const hooks = loadScheduleAppRuntime().roomCatalogTestHooks;
  const backend = fs.readFileSync(path.join(__dirname, '..', '..', 'App-Backend', 'server.js'), 'utf8');
  const fiveColumn = hooks.normalizeRoomCatalog([
    { Campus: 'COS', Building: 'CEDAR', Room: '421', Capacity: '28', 'Room Type': 'Computer Lab' }
  ]);
  const onePriority = hooks.normalizeRoomCatalog([
    { Campus: 'TCC', Building: 'TULARE', Room: 'A101', Capacity: '42', 'Room Type': 'Classroom', 'Room Priority': 'Business' }
  ]);
  const normalizedFromKnownDivision = hooks.normalizeRoomCatalog([
    { Campus: 'TCC', Building: 'TULARE', Room: 'A100', Capacity: '40', 'Room Type': 'Classroom', 'Room Priority': 'science' }
  ], ['Science']);
  const twoPriority = hooks.normalizeRoomCatalog([
    { Campus: 'TCC', Building: 'TULARE', Room: 'A102', Capacity: '44', 'Room Type': 'Classroom', 'Priority Division 1': 'Science', 'Priority Division 2': 'Math', 'Room Features': 'Smart Classroom, HyFlex Equipment' }
  ]);
  const semicolonFeatures = hooks.normalizeRoomCatalog([
    { Campus: 'COS', Building: 'LAB', Room: '101', Capacity: '30', 'Room Type': 'Lab', Equipment: 'Science Lab; Movable Furniture; Distance Education Equipment' }
  ]);
  const notesFeatures = hooks.normalizeRoomCatalog([
    { Campus: 'COS', Building: 'SHOP', Room: '201', Capacity: '20', 'Room Type': 'Shop', Notes: 'Shop; Art Studio' }
  ]);
  const alternatePriorityRows = [
    { Building: 'A', Room: '1', Capacity: '10', 'Room Type': 'Lab', 'Priority Division': 'Science' },
    { Building: 'A', Room: '2', Capacity: '11', 'Room Type': 'Classroom', 'Secondary Division': 'Arts' },
    { Building: 'A', Room: '3', Capacity: '12', 'Room Type': 'Lecture', 'Primary Division': 'Math' },
    { Building: 'A', Room: '4', Capacity: '13', 'Room Type': 'Office', 'Dean Area': 'Health' },
    { Building: 'A', Room: '5', Capacity: '14', 'Room Type': 'Specialty', 'Assigned Division': 'CTE' },
    { Building: 'A', Room: '6', Capacity: '15', 'Room Type': 'Studio', 'Preferred Division': 'Language', 'Room Priority 2': 'Arts' }
  ];
  const alternatePriority = hooks.normalizeRoomCatalog(alternatePriorityRows);
  const warnings = hooks.roomPriorityWarnings([
    { Building: 'B', Room: '1', 'Priority Division': 'Bogus Area', 'Priority Division 2': 'Science' }
  ], ['Science', 'Math', 'Business', 'Arts']);
  const attachedHeaderRows = hooks.normalizeRoomCatalog([
    { Campus: 'HAC', Building: 'HACEDU', Room: 'E37', Capacity: '72', 'Room Type': 'Classroom', 'Room Priority': 'Administration', 'Room Priority_2': '' },
    { Campus: 'COS', Building: 'SCI', Room: '101', Capacity: '36', 'Room Type': 'Science Lab', 'Room Priority': 'Science', 'Room Priority_2': 'Industry and Technology' }
  ]);
  const adminRoom = hooks.normalizeRoomCatalog([{ Building: 'ADM', Room: '1', 'Priority Division': 'Administration' }])[0];
  const scienceRoom = hooks.normalizeRoomCatalog([{ Building: 'SCI', Room: '1', 'Priority Division': 'Science' }])[0];
  const exported = JSON.parse(hooks.roomCatalogToCsv(twoPriority));
  const attachedExport = JSON.parse(hooks.roomCatalogToCsv(attachedHeaderRows));

  assert.equal(fiveColumn.length, 1);
  assert.equal(fiveColumn[0].capacity, 28);
  assert.equal(fiveColumn[0].type, 'Computer Lab');
  assert.equal(fiveColumn[0].priorityDivision1, 'Unassigned');
  assert.equal(fiveColumn[0].priorityDivision2, 'None');
  assert.equal(fiveColumn[0].rawRoomFeatures, '');
  assert.equal(JSON.stringify(fiveColumn[0].roomFeatures), JSON.stringify([]));
  assert.equal(onePriority[0].priorityDivision1, 'Business');
  assert.equal(onePriority[0].priorityDivision2, 'None');
  assert.equal(normalizedFromKnownDivision[0].priorityDivision1, 'Science');
  assert.equal(twoPriority[0].rawPriorityDivision1, 'Science');
  assert.equal(twoPriority[0].rawPriorityDivision2, 'Math');
  assert.equal(twoPriority[0].priorityDivision1, 'Science');
  assert.equal(twoPriority[0].priorityDivision2, 'Math');
  assert.equal(twoPriority[0].rawRoomFeatures, 'Smart Classroom, HyFlex Equipment');
  assert.equal(JSON.stringify(twoPriority[0].roomFeatures), JSON.stringify(['Smart Classroom', 'HyFlex Equipment']));
  assert.equal(twoPriority[0].roomFeaturesText, 'Smart Classroom; HyFlex Equipment');
  assert.equal(JSON.stringify(semicolonFeatures[0].roomFeatures), JSON.stringify(['Science Lab', 'Movable Furniture', 'Distance Education Equipment']));
  assert.equal(JSON.stringify(notesFeatures[0].roomFeatures), JSON.stringify(['Shop', 'Art Studio']));
  assert.equal(JSON.stringify(alternatePriority.map(room => room.priorityDivision1)), JSON.stringify(['Science', 'Unassigned', 'Math', 'Health', 'CTE', 'Language']));
  assert.equal(JSON.stringify(alternatePriority.map(room => room.priorityDivision2)), JSON.stringify(['None', 'Arts', 'None', 'None', 'None', 'Arts']));
  assert.equal(attachedHeaderRows[0].priorityDivision1, 'Administration');
  assert.equal(attachedHeaderRows[0].priorityDivision2, 'None');
  assert.equal(attachedHeaderRows[1].priorityDivision1, 'Science');
  assert.equal(attachedHeaderRows[1].priorityDivision2, 'Industry and Technology');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].warning, 'Unknown Priority Division');
  assert.equal(hooks.roomPriorityScore(adminRoom, 'Science'), 0);
  assert.equal(hooks.roomPriorityScore(scienceRoom, 'Science'), 2);
  assert.equal(hooks.roomPriorityScore(scienceRoom, 'Arts'), -1);
  assert.equal(exported[0].Campus, 'TCC');
  assert.equal(exported[0].Building, 'TULARE');
  assert.equal(exported[0].Room, 'A102');
  assert.equal(exported[0].Capacity, 44);
  assert.equal(exported[0]['Room Type'], 'Classroom');
  assert.equal(exported[0]['Priority Division 1'], 'Science');
  assert.equal(exported[0]['Priority Division 2'], 'Math');
  assert.equal(exported[0]['Room Features'], 'Smart Classroom; HyFlex Equipment');
  assert.equal(attachedExport[0]['Priority Division 1'], 'Administration');
  assert.equal(attachedExport[0]['Priority Division 2'], 'None');
  assert.equal(attachedExport[1]['Priority Division 1'], 'Science');
  assert.equal(attachedExport[1]['Priority Division 2'], 'Industry and Technology');
  assert.match(backend, /'Room Priority_2'/);
  assert.match(backend, /priorityDivision1/);
  assert.match(backend, /priorityDivision2/);
  assert.match(backend, /roomFeaturesText/);
});

test('room catalog table is collapsed separately from import export controls', () => {
  const runtime = loadScheduleAppRuntime();
  const hooks = runtime.roomCatalogTestHooks;
  const document = runtime.testDocument;
  hooks.setupRoomCatalogAdmin();

  const admin = document.getElementById('room-catalog-admin');
  const tableSection = document.getElementById('room-catalog-table-section');
  const toggle = document.getElementById('room-catalog-table-toggle');
  const title = document.getElementById('room-catalog-table-title');
  const preview = document.getElementById('room-catalog-preview');
  const status = document.getElementById('room-catalog-status');
  const textOf = node => {
    if (typeof node === 'string') return node;
    return [node?.textContent || '', ...(node?.children || []).map(textOf)].join(' ');
  };
  const topLevelText = textOf(admin);

  assert.ok(tableSection);
  assert.ok(toggle);
  assert.ok(preview);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(preview.hidden, true);
  assert.match(title.textContent, /^Room Catalog Table — \d+ rooms$/);
  assert.match(status.textContent, /\d+ rooms loaded\./);
  assert.match(topLevelText, /Room Catalog/);
  assert.match(topLevelText, /Export Rooms CSV/);
  assert.match(topLevelText, /Export Rooms JSON/);
  assert.match(topLevelText, /Import Rooms:/);

  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(preview.hidden, false);
  assert.equal(tableSection.classList.contains('is-collapsed'), false);

  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(preview.hidden, true);
  assert.equal(tableSection.classList.contains('is-collapsed'), true);
});

test('modality comparison rows include class offering counts and shares', () => {
  const hooks = loadScheduleAppRuntime();
  const current = hooks.calculateModalityBalanceFromItems([
    { category: 'In-Person', rawMethod: 'IP', enrollment: 20 },
    { category: 'In-Person', rawMethod: 'IP', enrollment: 15 },
    { category: 'Online', rawMethod: 'ONL', enrollment: 30 }
  ]);
  const comparison = hooks.calculateModalityBalanceFromItems([
    { category: 'In-Person', rawMethod: 'IP', enrollment: 10 },
    { category: 'Online', rawMethod: 'ONL', enrollment: 40 },
    { category: 'Online', rawMethod: 'ONL', enrollment: 20 }
  ]);
  const rows = hooks.modalityCombinedComparisonRows(
    new Map(current.map(row => [row.category, row])),
    new Map(comparison.map(row => [row.category, row]))
  );
  const inPerson = rows.find(row => row.category === 'In-Person');
  const online = rows.find(row => row.category === 'Online');

  assert.equal(inPerson.currentClassOfferings, 2);
  assert.equal(inPerson.comparisonClassOfferings, 1);
  assert.equal(inPerson.classOfferingDiff, 1);
  assert.equal(inPerson.currentClassOfferingShare, 2 / 3);
  assert.equal(online.currentClassOfferings, 1);
  assert.equal(online.comparisonClassOfferings, 2);
  assert.equal(online.currentEnrollment, 30);
  assert.equal(online.comparisonEnrollment, 60);
});

test('modality source exposes total class offerings term comparison', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  assert.match(app, /function modalityTotalClassOfferingComparisonRows/);
  assert.match(app, /currentClassOfferings: focusTotals\.classOfferings/);
  assert.match(app, /comparisonClassOfferings: comparisonTotals\.classOfferings/);
  assert.match(app, /classOfferingDiff: focusTotals\.classOfferings - comparisonTotals\.classOfferings/);
  assert.match(app, /Positive means the focus term scheduled more offerings; negative means fewer/);
  assert.match(app, /Section: 'Total Class Offerings Term Comparison'/);
  assert.match(app, /Net total class offerings across all modalities/);
});

test('modality division filter preserves matching rows and summary counts', () => {
  const hooks = loadScheduleAppRuntime();
  const rows = [
    { Term: 'FALL 2026', CRN: '20001', Division: ' Student Services ', Subject: 'COUN', Course: '100', 'Instructional Method': 'IP', CENSUS_ENROLL: '22' },
    { Term: 'FALL 2026', CRN: '20002', DIVISION: 'student services', Subject: 'COUN', Course: '101', 'Instructional Method': 'ONL', CENSUS_ENROLL: '18' },
    { Term: 'FALL 2026', CRN: '20003', Division: 'Arts', Subject: 'ART', Course: '101', 'Instructional Method': 'HYB', CENSUS_ENROLL: '12' }
  ];
  const filtered = hooks.modalityFilteredSections({
    sourceRows: rows,
    term: 'FALL 2026',
    selectedDivision: ['Student Services']
  });
  const summary = hooks.calculateModalityBalanceFromItems(filtered.rows, { filterDebug: filtered.debug });

  assert.equal(filtered.debug.rowsLoaded, 3);
  assert.equal(filtered.debug.rowsAfterDivisionFilter, 2);
  assert.equal(filtered.debug.finalRows, 2);
  assert.equal(JSON.stringify(filtered.rows.map(row => row.courseCode).sort()), JSON.stringify(['COUN 100', 'COUN 101']));
  assert.equal(summary[0].totalClassOfferings, 2);
  assert.equal(summary[0].totalEnrollment, 40);

  const cleared = hooks.modalityFilteredSections({ sourceRows: rows, term: 'FALL 2026', selectedDivision: [] });
  assert.equal(cleared.rows.length, 3);
});

test('modality division filtering works for historical comparison rows', () => {
  const hooks = loadScheduleAppRuntime();
  const historicalRows = [
    { Term: 'FALL 2025', CRN: '30001', Division: 'Student Services', Subject: 'COUN', Course: '100', 'Instructional Method': 'IP', CENSUS_ENROLL: '20' },
    { Term: 'FALL 2025', CRN: '30002', Division: 'Arts', Subject: 'ART', Course: '101', 'Instructional Method': 'ONL', CENSUS_ENROLL: '30' }
  ];
  const filtered = hooks.modalityFilteredSections({
    sourceRows: historicalRows,
    term: 'FALL 2025',
    selectedDivision: ['student services']
  });
  const comparison = hooks.calculateModalityBalanceFromItems(filtered.rows);

  assert.equal(filtered.rows.length, 1);
  assert.equal(filtered.rows[0].division, 'Student Services');
  assert.equal(comparison[0].totalClassOfferings, 1);
  assert.equal(comparison[0].totalEnrollment, 20);
});

test('modality chart and export data separate class offerings from enrollment', () => {
  const hooks = loadScheduleAppRuntime();
  const summary = hooks.calculateModalityBalanceFromItems([
    { category: 'In-Person', rawMethod: 'IP', enrollment: 20 },
    { category: 'In-Person', rawMethod: 'IP', enrollment: 10 },
    { category: 'Online', rawMethod: 'ONL', enrollment: 70 }
  ]);
  const chartData = hooks.modalityChartData(summary);
  const exportRows = hooks.modalityExportRowsForData(summary, []);

  assert.deepEqual([...chartData.classOfferings.map(row => row.category)], ['In-Person', 'Online']);
  assert.deepEqual([...chartData.enrollment.map(row => row.category)], ['In-Person', 'Online']);
  assert.equal(chartData.classOfferings.find(row => row.category === 'In-Person').value, 2);
  assert.equal(chartData.enrollment.find(row => row.category === 'In-Person').value, 30);
  assert.ok(exportRows.some(row => row.ClassOfferings === 2 && /Class Offering/.test(row.Metric + row.Chart)));
  assert.ok(exportRows.some(row => Object.prototype.hasOwnProperty.call(row, 'ClassOfferingShare')));
});

test('data validation and mapping keeps instructional method diagnostics available under Admin', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  assert.match(app, /instructionalMethodValidation: 'instructional-method-validation'/);
  assert.match(app, /\[REPORTS\.instructionalMethodValidation\]: 'admin'/);
  assert.match(app, /Data Validation & Mapping/);
  assert.match(app, /id="instructionalMethodValidationReport"/);
  assert.match(app, /id="instructionalMethodValidationCsv"/);
  assert.match(app, /id="instructionalMethodValidationArchiveTerms"/);
  assert.match(app, /id="runInstructionalMethodValidation"/);
  assert.match(app, /id="exportInstructionalMethodValidation"/);
  assert.match(app, /setReportDisplay\(REPORTS\.instructionalMethodValidation, 'instructionalMethodValidationReport'\)/);
  assert.match(app, /instructional-method-validation\.csv/);
  assert.match(app, /Unknown\/unmapped code/);
  assert.match(app, /Online\/TBA placeholder detected/);
});

test('instructional method validation surfaces unknown codes instead of silently including them', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    COSEnrollmentAnalytics.normalizeRow({
      Term: 'FALL 2026',
      CRN: '90001',
      Subject: 'HIST',
      Course: '018',
      INSTRUCTIONAL_METHOD_CODE: 'ZZZ',
      'Instructional Method': 'ZZZ',
      CENSUS_ENROLL: '22',
      ACTUAL_ENROLL: '24'
    }),
    COSEnrollmentAnalytics.normalizeRow({
      Term: 'FALL 2026',
      CRN: '90002',
      Subject: 'ENGL',
      Course: 'C1000',
      INSTRUCTIONAL_METHOD_CODE: 'IP',
      'Instructional Method': 'IP',
      CENSUS_ENROLL: '30'
    })
  ];
  const validation = COSEnrollmentAnalytics.instructionalMethodValidationRows(rows);
  const unknown = validation.find(row => row.rawInstructionalMethodCode === 'ZZZ');
  const inPerson = validation.find(row => row.rawInstructionalMethodCode === 'IP');

  assert.equal(unknown.normalizedModality, 'Unknown');
  assert.equal(unknown.rowCount, 1);
  assert.equal(unknown.crnCount, 1);
  assert.equal(unknown.includedByDefaultInPhysicalTimeAnalysis, 'No');
  assert.match(unknown.flags, /Unknown\/unmapped code/);
  assert.match(unknown.flags, /Excluded from standard analytics/);
  assert.equal(inPerson.normalizedModality, 'In-Person');
  assert.equal(inPerson.includedByDefaultInPhysicalTimeAnalysis, 'Yes');
});

test('requested analytics regression coverage is represented in smoke tests', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  [
    /function conflictRows/,
    /crossList: \['CROSS_LIST'/,
    /conflictOmitCrossListed/,
    /conflictSeparateTypes/,
    /hasCrossList/,
    /Same Room \+ Same Instructor/,
    /function conflictInspectionRows/,
    /inspectConflictArchive/,
    /overlapMinutes/,
    /CENSUS_ENROLL2/,
    /lifecycleMetricLabel\(value\)/,
    /sectionsMissingFirstDaySnapshot/,
    /handleAttritionError/,
    /runAttrition\(\)\.catch\(handleAttritionError\)/,
    /conDecisionSeason/,
    /conDecisionYear/,
    /function consolidationDecisionTerm/,
    /dashDecisionSeason/,
    /dashDecisionYear/,
    /function dashboardFocusTerm/,
    /snapSeason/,
    /snapYear/,
    /function snapshotTerm/,
    /spHideOnline/,
    /spIncludeDualEnrollment/,
    /spIncludeOtherModalities/,
    /spCampusScope/,
    /function studentPresenceCampusScope/,
    /function studentPresenceScopedRows/,
    /campuses\.has\(canon\(row\.campus\)\)/,
    /studentPresenceExportRows/,
    /function exportStudentPresenceRows/,
    /All COS\/HAC\/TCC/,
    /spCompareTerms/,
    /function renderStudentPresenceCurve/,
    /function studentPresenceHasUsableFixedTime/,
    /start >= 6 \* 60/,
    /studentPresenceChartFilter/,
    /getElementsAtEventForMode/,
    /Clear graph filter/,
    /studentPresenceChartSources/,
    /sourceRows: termRows/,
    /studentPresenceFilteredSectionRows/,
    /rowStart < end && rowEnd > start/,
    /borderDash: sourceIndex \? \[6, 4\] : \[\]/,
    /distinctCrns/,
    /meetingRowsIncluded/
  ].forEach(pattern => assert.match(text, pattern));

  [
    /getModalityCategory/,
    /COSModalityNormalizer\.normalize/,
    /isReportableModalityCategory/,
    /modality-include-de/,
    /calculateRoomFitFlags/,
    /Underutilized Room/,
    /Over Capacity Risk/,
    /Enrollment Exceeds Room Capacity/
  ].forEach(pattern => assert.match(app, pattern));
});

test('room utilization includes room capacity fit flags', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  assert.match(index, /Room Capacity Fit Flags/);
  assert.match(index, /Room Capacity/);
  assert.match(index, /Section Capacity/);
  assert.match(index, /Census\/Current Enrollment/);
  assert.match(index, /Fit Ratio/);
  assert.match(app, /calculateRoomFitFlags/);
  assert.match(app, /Underutilized Room/);
  assert.match(app, /Over Capacity Risk/);
  assert.match(app, /Enrollment Exceeds Room Capacity/);
  assert.match(app, /room-capacity-fit-flags\.csv/);
  assert.match(css, /\.room-fit-table/);
});

test('room utilization uses component scoring instead of fixed prime bump', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const enrollment = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const consolidation = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment/consolidation.js'), 'utf8');

  assert.match(index, /js\/core\/csv-normalizer\.js/);
  assert.match(index, /js\/core\/section-model\.js/);
  assert.match(app, /function getCanonicalSection/);
  assert.match(app, /canonicalSection/);
  assert.match(enrollment, /sectionModel\?\.normalizeSection/);
  assert.match(consolidation, /sectionModel\.sectionIdentity/);
  assert.match(index, /component model instead of a fixed prime-time multiplier/);
  assert.match(index, /Overall Room Utilization Score = Overall Utilization 40% \+ Prime-Time Utilization 25% \+ Distribution Score 20% \+ Fragmentation Score 15%/);
  assert.match(index, /Opportunity Score/);
  assert.match(index, /utilization-sort-select/);
  assert.match(index, /utilization-building-select/);
  assert.match(index, /utilization-min-capacity/);
  assert.match(index, /utilization-max-capacity/);
  assert.match(index, /utilization-min-overall/);
  assert.match(index, /utilization-min-prime/);
  assert.match(index, /utilization-min-opportunity/);
  assert.match(index, /utilization-min-distribution/);
  assert.match(index, /utilization-min-fragmentation/);
  assert.doesNotMatch(index, /receive an extra 0\.5x bump/);
  assert.match(app, /utilizationConfig/);
  assert.match(app, /weights:\s*{\s*overall: 0\.4,\s*prime: 0\.25,\s*distribution: 0\.2,\s*fragmentation: 0\.15/s);
  assert.match(app, /const score =\s*\(overallUtilization \* utilizationConfig\.weights\.overall\)/s);
  assert.match(app, /roomUtilizationRecommendation/);
  assert.match(app, /Prime-time demand exists, but room is underutilized outside peak periods/);
  assert.match(app, /Usage is concentrated; review for schedule balancing/);
  assert.match(app, /Fragmented usage; review for cleaner scheduling blocks/);
  assert.match(app, /Available for additional scheduling/);
  assert.match(app, /longestEmptyPrimeBlockHours/);
  assert.match(app, /utilizationBuildingSelect/);
  assert.match(app, /minOpportunity/);
  assert.match(app, /activeTimeBlocks/);
  assert.match(app, /selectedUtilizationCategories/);
  assert.match(app, /dataset\.utilizationCategory/);
  assert.match(app, /utilization-pill-filter/);
  assert.match(app, /filterRoomUtilizationRowsByCategory/);
  assert.match(app, /roomMatchesUtilizationCategory\(room, category\)/);
  assert.match(app, /label === 'High Opportunity'/);
  assert.match(app, /label === 'Fragmented'/);
  assert.doesNotMatch(app, /peakCreditMinutes \* 1\.5/);
});

test('room utilization category cards support multi-select filters and exports', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  assert.match(app, /const utilizationCategoryLabels = \[/);
  ['Not Utilized', 'Very Efficient', 'Efficient', 'Moderately Utilized', 'Under Utilized', 'High Opportunity', 'Fragmented'].forEach(label => {
    assert.match(app, new RegExp(label));
  });
  assert.match(app, /selectedUtilizationCategories\.add\(category\)/);
  assert.match(app, /selectedUtilizationCategories\.delete\(category\)/);
  assert.match(app, /active\.some\(category => roomMatchesUtilizationCategory\(room, category\)\)/);
  assert.match(app, /dataset\.utilizationCategoryAction = action/);
  assert.match(app, /Select All/);
  assert.match(app, /Clear Category Filters/);
  assert.match(app, /aria-pressed/);
  assert.match(app, /getActiveRoomUtilizationKeys/);
  assert.match(app, /activeUtilizationRoomKeys\.has\(`\$\{row\.building\}-\$\{row\.room\}`\)/);
  assert.match(app, /downloadTextFile\('room-capacity-fit-flags\.csv'/);
  assert.match(css, /\.utilization-filter-actions/);
  assert.match(css, /\.utilization-pill-info/);
});

test('heatmap exposes optional metric modes and summary cards', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  assert.match(index, /heatmap-metric-select/);
  assert.doesNotMatch(index, /Enrollment-weighted|Enrollment-Weighted|Enrollment Weighted/);
  assert.match(index, /Enrollment Heatmap/);
  assert.match(index, /Seat Capacity Heatmap/);
  assert.match(index, /Fill Rate Heatmap/);
  assert.match(index, /heatmap-prime-only/);
  assert.match(index, /heatmap-underutilized-only/);
  assert.match(index, /heatmap-summary-cards/);
  assert.match(index, /distinct CRNs/);
  assert.match(index, /00:00-00:59 placeholder/);
  assert.match(app, /heatmapMetricMode/);
  assert.match(app, /renderHeatmapSummaryCards/);
  assert.match(app, /sections: 'Section Count Heatmap'/);
  assert.match(app, /enrollment: 'Enrollment Heatmap'/);
  assert.match(app, /function heatmapHasFacultyTypeRows/);
  assert.match(app, /function buildHeatmapCells/);
  assert.match(app, /function renderHeatmapTableMarkup/);
  assert.match(app, /function heatmapExportRows/);
  assert.match(app, /function heatmapExportOptions/);
  assert.match(app, /title: `\$\{groupLabel\}\$\{heatmapMetricLabel\(metric\)\} - Heatmap Analytics`/);
  assert.match(app, /reportName: `\$\{facultyType \? `\$\{facultyHeatmapGroupLabel\(facultyType\)\} - ` : ''\}\$\{heatmapMetricLabel\(metric\)\} - Heatmap Analytics`/);
  assert.match(app, /Faculty Heatmap \(All Faculty\)/);
  assert.match(app, /Faculty Heatmap \(Full-Time Faculty\)/);
  assert.match(app, /Faculty Heatmap \(Part-Time Faculty\)/);
  assert.match(app, /Faculty Type', visible: false/);
  assert.match(app, /FacultyType: facultyType/);
  assert.match(app, /if \(r\.FacultyType === 'OMIT'\) return false/);
  assert.match(app, /data-faculty-type="\$\{escapeHTML\(facultyType\)\}"/);
  assert.match(app, /const sharedMax = Math\.max\(0, \.\.\.builtPanels\.flatMap/);
  assert.match(app, /isPrimeHeatmapSlot/);
  assert.match(app, /isUnderutilizedHeatmapRow/);
  assert.match(app, /rowEnrollment/);
  assert.match(app, /rowCapacity/);
  assert.match(app, /title: 'CRN\(s\)'/);
  assert.match(app, /function dedupeHeatmapRows/);
  assert.match(app, /function heatmapCrnKey/);
  assert.match(app, /function isOnlineTbaHeatmapRow/);
  assert.match(app, /cells\[d\]\[startIndex\]\.crns\.has\(bucketKey\)/);
  assert.match(css, /\.analysis-summary-cards/);
  assert.match(css, /#heatmapContainer \{\s*min-height: 600px;\s*overflow-x: auto;/);
  assert.match(css, /\.heatmap \{\s*width: max-content;\s*min-width: 100%;\s*table-layout: fixed;/);
  assert.match(css, /\.heatmap-wrap \{\s*width: 100%;\s*max-width: 100%;\s*overflow-x: auto;/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.heatmap-time-label/);
  assert.match(css, /\.visualization-section \{\s*display: flex;\s*flex-direction: column;\s*width: 100%;/);
  assert.match(css, /\.visualization-toolbar \{\s*width: 100%;/);
  assert.match(css, /\.visualization-body \{\s*display: block;\s*width: 100%;/);
  assert.match(css, /\.visualization-body > \.heatmap-wrap,/);
  assert.match(css, /\.visualization-export-toolbar/);
  assert.match(css, /\.visualization-export-dropdown/);
  assert.match(css, /\.heatmap-faculty-panel/);
  assert.doesNotMatch(css, /\.heatmap th,[\s\S]*?overflow-wrap: anywhere;/);
});

test('heatmap terminology distinguishes aggregation from true weighting', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const definitions = fs.readFileSync(path.join(__dirname, '..', 'js/core/metric-definitions.js'), 'utf8');
  const shared = fs.readFileSync(path.join(__dirname, '..', 'js/shared/utils.js'), 'utf8');
  const heatmapText = [index, app, analytics, definitions, shared].join('\n');

  assert.doesNotMatch(heatmapText, /Enrollment-weighted|Enrollment-Weighted|Enrollment Weighted/);
  assert.match(index, /<option value="enrollment">Enrollment Heatmap<\/option>/);
  assert.match(app, /\['Enrollment Heatmap', 'Sums enrollment for distinct CRNs beginning in each 30-minute day\/time block\.'\]/);
  assert.match(definitions, /\['enrollment-heatmap', 'Enrollment Heatmap'/);
  assert.match(definitions, /This is enrollment aggregation by scheduled start time, not weighting\./);
  assert.match(definitions, /\['student-presence-heatmap', 'Student Presence Heatmap'/);
  assert.match(definitions, /\['frequency-weighted-student-presence', 'Frequency-Weighted Student Presence'/);
  assert.match(analytics, /Nominal Scheduled Presence/);
  assert.match(analytics, /Expected Physical Presence/);
  assert.match(analytics, /Meeting Frequency Factor/);
  assert.match(app, /metric: heatmapMetricLabel\(metric\)/);
  assert.match(app, /title: `\$\{groupLabel\}\$\{heatmapMetricLabel\(metric\)\} - Heatmap Analytics`/);
});

test('heatmap table layout keeps day labels readable and time headers two-line', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  assert.match(app, /<th class="heatmap-day-header">Day<\/th>/);
  assert.doesNotMatch(app, /Day\/Start Time/);
  assert.match(app, /<th class="heatmap-time-header">\$\{formatHeatmapTimeHeader\(h\)\}<\/th>/);
  assert.match(app, /heatmap-cell heatmap-value-cell/);
  assert.match(analytics, /<th class="heatmap-day-header">Day<\/th>/);
  assert.match(analytics, /heatmap-time-header/);
  assert.match(analytics, /heatmap-day-cell/);
  assert.match(analytics, /heatmap-value-cell/);
  assert.match(css, /\.heatmap-day-header,\s*\.heatmap-day-cell \{\s*position: sticky;\s*left: 0;\s*z-index: 3;\s*width: 86px;\s*min-width: 80px;/);
  assert.match(css, /\.heatmap-day-header,[\s\S]*?white-space: nowrap;/);
  assert.match(css, /\.heatmap-time-header,[\s\S]*?min-width: 40px;/);
  assert.match(css, /\.heatmap th,\s*\.heatmap td \{[\s\S]*?font-size: 11px;/);
  assert.match(css, /@media \(min-width: 1280px\)/);
  assert.match(app, /<span class="heatmap-time-label"><span>\$\{escapeHTML\(time\)\}<\/span><span>\$\{escapeHTML\(period \|\| ''\)\}<\/span><\/span>/);
  assert.match(analytics, /<span class="heatmap-time-label"><span>\$\{escapeAttr\(time\)\}<\/span><span>\$\{escapeAttr\(period \|\| ''\)\}<\/span><\/span>/);
});

test('heatmap visual exports are wired for full heatmap capture and metadata CSV', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const utils = fs.readFileSync(path.join(__dirname, '..', 'js/shared/utils.js'), 'utf8');

  ['exportHeatmapAsPng', 'copyHeatmapImage', 'exportHeatmapAsPdf', 'exportHeatmapMatrixCsv', 'renderHeatmapExportToolbar', 'renderVisualizationExportMenu', 'exportVisualizationPng', 'copyVisualizationImage', 'exportVisualizationPdf', 'exportVisualizationCsv'].forEach(name => {
    assert.match(utils, new RegExp(name));
  });
  assert.match(utils, /cloneHeatmapForExport/);
  assert.match(utils, /left = '-100000px'/);
  assert.match(utils, /windowWidth: width/);
  assert.match(utils, /windowHeight: height/);
  assert.match(utils, /ClipboardItem/);
  assert.match(utils, /downloaded PNG instead/);
  assert.match(utils, /Report name/);
  assert.match(utils, /Selected filters/);
  assert.match(utils, /Metric selected/);
  assert.match(utils, /Modality scope/);
  assert.match(utils, /Exported/);
  assert.match(utils, /title \|\| 'Heatmap'/);
  ['Export PNG', 'Copy Image', 'Export PDF', 'Export CSV'].forEach(label => {
    assert.match(utils, new RegExp(label));
  });
  assert.match(utils, /aria-haspopup="menu"/);
  assert.match(utils, /aria-expanded="false"/);
  assert.match(utils, /role="menu"/);
  assert.match(utils, /role="menuitem"/);
  assert.match(utils, /event\.key === 'Escape'/);
  assert.match(utils, /document\.addEventListener\('click'/);
  assert.match(utils, /preferredVisualizationAnchor/);
  assert.match(utils, /function placeVisualizationToolbar/);
  assert.match(utils, /section\.className = 'visualization-section'/);
  assert.match(utils, /body\.className = 'visualization-body'/);
  assert.match(utils, /toolbar\.className = 'visualization-toolbar visualization-export-toolbar heatmap-export-toolbar'/);
  assert.match(utils, /section\.append\(toolbar, body\)/);
  assert.doesNotMatch(utils, /host\.insertBefore\(toolbar, anchor\)/);
  assert.match(app, /renderHeatmapExportToolbar\(document\.getElementById\('heatmapContainer'\)/);
  assert.match(app, /renderHeatmapExportToolbar\(document\.getElementById\(`heatmapFacultyPanel_\$\{panel\.key\}`\)/);
  assert.match(app, /renderModalityChartExportMenu/);
  assert.match(app, /renderVisualizationExportMenu\(modalityChart/);
  assert.match(app, /anchor: '\.modality-pie-grid'/);
  assert.match(app, /heatmapExportRows\(panel\.built\.allCells/);
  assert.match(app, /heatmapExportRows\(baseHeatmap\.allCells/);
  assert.match(analytics, /panels\.forEach\(panel => attachHeatmapExportToolbar\(panel\.id/);
  assert.match(analytics, /attachHeatmapExportToolbar\('supplyDemandHeatmap'/);
  assert.match(analytics, /attachHeatmapExportToolbar\('studentChoiceHeatmap'/);
  assert.match(analytics, /normalizeHeatmapMatrixRows/);
});

test('visualization export menu uses full-width toolbar and body wrapper', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  const utils = fs.readFileSync(path.join(__dirname, '..', 'js/shared/utils.js'), 'utf8');

  assert.match(utils, /const section = document\.createElement\('section'\)/);
  assert.match(utils, /section\.className = 'visualization-section'/);
  assert.match(utils, /const body = document\.createElement\('div'\)/);
  assert.match(utils, /body\.className = 'visualization-body'/);
  assert.match(utils, /body\.appendChild\(visualNode\)/);
  assert.match(utils, /section\.append\(toolbar, body\)/);
  assert.match(css, /\.visualization-section \{[\s\S]*?flex-direction: column;/);
  assert.match(css, /\.visualization-toolbar \{[\s\S]*?width: 100%;/);
  assert.match(css, /\.visualization-body \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/);
  assert.match(css, /\.heatmap-wrap \{[\s\S]*?width: 100%;/);
  assert.doesNotMatch(css, /\.visualization-section \{[^}]*flex-direction: row/);
});

test('collapsible section helper defaults open toggles aria and persists state', () => {
  const { utils, document, storage } = loadCollapsibleUtilsRuntime();
  const target = document.createElement('div');
  target.id = 'sample-section';
  target.textContent = 'Body';
  document.body.appendChild(target);

  const section = utils.applyCollapsibleSection(target, { title: 'Sample Section' });
  const button = section.querySelector('.collapsible-section-toggle');
  const body = section.querySelector('.collapsible-section-body');

  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(body.hidden, false);
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(body.hidden, true);
  assert.equal(storage.get('cos-collapsible-section:sample-section'), 'collapsed');

  const persistedTarget = document.createElement('div');
  persistedTarget.id = 'sample-section';
  document.body.appendChild(persistedTarget);
  const persistedSection = utils.applyCollapsibleSection(persistedTarget, { title: 'Sample Section' });
  assert.equal(persistedSection.querySelector('.collapsible-section-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(persistedSection.querySelector('.collapsible-section-body').hidden, true);

  const generatedTarget = document.createElement('section');
  generatedTarget.dataset.collapsibleTitle = 'Generated Collapsed';
  generatedTarget.dataset.collapsibleId = 'generated-collapsed';
  generatedTarget.dataset.collapsibleDefaultOpen = 'false';
  document.body.appendChild(generatedTarget);
  const [generatedSection] = utils.applyCollapsibleSections(document);
  assert.equal(generatedSection.querySelector('.collapsible-section-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(generatedSection.querySelector('.collapsible-section-body').hidden, true);
});

test('metric help registry opens and closes accessible popovers', () => {
  const { utils, document } = loadCollapsibleUtilsRuntime();
  const card = document.createElement('div');
  document.body.appendChild(card);

  const help = utils.MetricHelpProvider.attach(card, 'high-opportunity');
  const missingCard = document.createElement('div');

  assert.ok(help);
  assert.equal(help.trigger.getAttribute('aria-label'), 'Explain High Opportunity');
  assert.equal(help.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(help.popover.getAttribute('role'), 'tooltip');
  assert.equal(help.popover.hidden, true);
  help.trigger.eventHandlers.mouseenter();
  assert.equal(help.popover.hidden, false);
  assert.equal(help.trigger.getAttribute('aria-expanded'), 'true');
  help.trigger.eventHandlers.click({ stopPropagation() {} });
  assert.equal(help.popover.hidden, true);
  assert.match(help.popover.innerHTML, /Definition:/);
  assert.match(help.popover.innerHTML, /Calculation:/);
  assert.match(help.popover.innerHTML, /Interpretation:/);
  assert.match(help.popover.innerHTML, /Planning Guidance:/);
  assert.match(help.popover.innerHTML, /Review before requesting additional classroom inventory/);
  assert.equal(utils.MetricHelpProvider.attach(missingCard, 'missing-metric-id'), null);
  assert.equal(missingCard.children.length, 0);
});

test('room utilization summary cards include standardized metric help', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const definitions = fs.readFileSync(path.join(__dirname, '..', 'js/core/metric-definitions.js'), 'utf8');
  const help = fs.readFileSync(path.join(__dirname, '..', 'js/core/metric-help.js'), 'utf8');

  assert.match(index, /js\/core\/metric-definitions\.js/);
  assert.match(index, /js\/core\/metric-help\.js/);
  assert.match(definitions, /MetricDefinitionRegistry/);
  assert.match(definitions, /Object\.freeze/);
  assert.doesNotMatch(definitions, /registerMany|register\(/);
  assert.match(help, /MetricHelpProvider/);
  assert.match(help, /registry\.get/);
  assert.match(help, /return null/);
  assert.match(help, /aria-label', `Explain \$\{definition\.displayName\}`/);
  assert.match(help, /role', 'tooltip'/);
  assert.match(help, /event\.key === 'Escape'/);
  ['rooms', 'not-utilized', 'very-efficient', 'efficient', 'moderately-utilized', 'under-utilized', 'high-opportunity', 'fragmented'].forEach(id => {
    assert.match(definitions, new RegExp(`'${id}'`));
  });
  assert.match(app, /MetricHelpProvider\?\.attach\?\.\(pill, label/);
  assert.match(app, /setAttribute\('role', 'button'\)/);
  assert.match(app, /aria-pressed/);
  assert.match(app, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(css, /\.metric-help-trigger/);
  assert.match(css, /\.metric-help-popover/);
  assert.match(css, /\.metric-card-label/);
});

test('metric definition help is presentation-only across scoped summary cards', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const registry = require('../js/core/metric-definitions.js');

  assert.equal(registry.has('scheduled-class-offerings'), true);
  assert.equal(registry.has('missing-metric-id'), false);
  assert.ok(registry.get('fill-rate').shortDefinition);
  assert.ok(Object.isFrozen(registry.get('fill-rate')));
  assert.ok(Object.isFrozen(registry.all()[0].dataSources));
  assert.equal(typeof registry.register, 'undefined');
  assert.equal(typeof registry.get('fill-rate').calculation, 'string');

  assert.match(app, /window\.MetricHelpProvider\?\.attach\?\.\(pill, label/);
  assert.match(app, /window\.MetricHelpProvider\?\.attach\?\.\(pill, metricId\)/);
  assert.match(analytics, /window\.MetricHelpProvider\?\.attach\?\.\(card, metricId\)/);
  [
    /'scheduled-class-offerings'/,
    /'instructional-meetings'/,
    /'full-time-faculty'/,
    /'part-time-faculty'/,
    /'seats-offered'/,
    /'hidden-demand'/,
    /'oversupply'/,
    /'choice-diversity-index'/,
    /'demand-pressure-score'/,
    /'lhe'/
  ].forEach(pattern => assert.match(analytics + app, pattern));

  assert.match(index, /id="avail-search-panel"/);
  assert.match(index, /id="avail-results"/);
  assert.doesNotMatch(index, /MetricHelpProvider[\s\S]*avail-results/);
  assert.doesNotMatch(app + analytics, /MetricDefinitionRegistry\.get/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8'), /read-only presentation layer used to explain metrics/);
});

test('collapsible sections are wired across reports without changing Room Availability ids', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  const utils = fs.readFileSync(path.join(__dirname, '..', 'js/shared/utils.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(utils, /function createCollapsibleSection/);
  assert.match(utils, /function applyCollapsibleSections/);
  ['collapsible-section', 'collapsible-section-header', 'collapsible-section-body'].forEach(className => {
    assert.match(css, new RegExp(`\\.${className}`));
  });
  ['room-filter', 'avail-search-panel', 'avail-results', 'avail-check-btn', 'avail-clear-btn'].forEach(id => {
    assert.match(index, new RegExp(`id="${id}"`));
  });
  assert.match(app, /registerSchedulingCollapsibleSections/);
  assert.match(app, /room-availability-results/);
  assert.match(app, /modality-instructional-method-details/);
  assert.match(analytics, /registerEnrollmentCollapsibleSections/);
  assert.match(analytics, /supply-demand-heatmap/);
  assert.match(analytics, /schedule-opportunity-line-graph/);
  assert.match(analytics, /recommendation-priority-list/);
  assert.match(analytics, /<details class="methodology-panel" open>/);
});

test('room availability grid defaults to first actual room instead of all rooms', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  assert.match(app, /const defaultRoom = roomOptions\[0\]\?\.value \|\| 'All'/);
  assert.match(app, /snapshotRoomFilter\.value = priorSnapshotRoom/);
  assert.match(app, /calendarRoomSelect\.value = priorCalendarRoom/);
  assert.match(app, /combos\.includes\(priorSnapshotRoom\)/);
  assert.match(app, /combos\.includes\(priorCalendarRoom\)/);
  assert.match(app, /: defaultRoom/);
});

test('development graphics default to container-width responsive layouts', () => {
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(analytics, /\.analytics-insights\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,260px\),1fr\)\)/);
  assert.match(analytics, /\.analytics-insights section\{min-width:0;/);
  assert.match(analytics, /\.presence-curve \.heatmap-wrap\{width:100%;max-width:100%;overflow-x:auto;overflow-y:visible;margin:0;padding:0\}/);
  assert.match(analytics, /\.presence-curve table\.heatmap-table\{width:max-content;min-width:100%;table-layout:fixed\}/);
  assert.match(analytics, /\.presence-curve \.heatmap th,\.presence-curve \.heatmap td\{box-sizing:border-box;padding:4px 2px;font-size:11px/);
  assert.match(analytics, /\.supply-demand-line svg\{display:block;width:100%;max-width:100%;height:auto;/);
  assert.match(analytics, /\.prime-time-gauge\{width:clamp/);
  assert.match(analytics, /@media \(max-width:760px\)\{/);
  assert.match(analytics, /\.presence-curve table\{min-width:720px\}/);
  assert.match(analytics, /function formatHeatmapTimeHeader/);
  assert.match(analytics, /\.presence-curve \.heatmap \.heatmap-time-label/);
  assert.doesNotMatch(analytics, /\.presence-curve \.heatmap th,\.presence-curve \.heatmap td\{[^}]*overflow-wrap:anywhere/);
});

test('standard analytics expose tutoring open lab exclusion controls and diagnostics', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  ['MATH 400', 'ENGL 400', 'LA 425'].forEach(course => {
    assert.match(analytics, new RegExp(course));
    assert.match(app, new RegExp(course));
  });
  [
    /\$\{prefix\}ExcludeTutoringOpenLab/,
    /roomFitExcludeTutoringOpenLab/,
    /Tutoring\/Open Lab Rows Excluded/,
    /Negative Census 2 values were detected and treated as invalid/
  ].forEach(pattern => assert.match(analytics, pattern));
  [
    /heatmap-exclude-tutoring-openlab/,
    /linechart-exclude-tutoring-openlab/,
    /modality-exclude-tutoring-openlab/,
    /utilization-exclude-tutoring-openlab/
  ].forEach(pattern => assert.match(index, pattern));
  [
    /function isTutoringOpenLabSection/,
    /roomFitExcludeTutoringOpenLab/,
    /Tutoring\/Open Lab Rows Excluded/
  ].forEach(pattern => assert.match(app, pattern));
});

test('duration graph uses nice y-axis tick steps', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  assert.match(index, /linechart-metric-select/);
  assert.match(index, /<option value="count" selected>Course Count<\/option>/);
  assert.match(index, /<option value="presence">Student Presence<\/option>/);
  assert.match(app, /buildHalfHourPresenceSeries\(filtered, hours/);
  assert.match(app, /metric: isPresenceMetric \? 'presence' : 'count'/);
  assert.match(app, /Estimated Students Present/);
  assert.match(app, /niceTickStep/);
  assert.match(app, /\[2, 5, 10, 20, 25, 50/);
});

test('student presence graph uses course duration line chart pattern inside presence analytics', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /Student Presence Graph/);
  assert.match(text, /studentPresenceLineChart/);
  assert.match(text, /buildHalfHourPresenceSeries/);
  assert.match(text, /Estimated Students Present/);
  assert.match(text, /legend: \{ position: 'bottom' \}/);
  assert.match(text, /Time of Day/);
  assert.match(text, /Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday/);
});

test('development report visuals expose concise hover tooltips', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /function analyticsTooltip/);
  assert.match(text, /Modality scope/);
  assert.match(text, /Faculty type/);
  assert.match(text, /Meeting type/);
  assert.match(text, /title="\$\{escapeAttr\(tooltip\)\}"/);
  assert.match(text, /<title>\$\{escapeAttr\(point\.tooltip\)\}<\/title>/);
  assert.match(text, /Estimated Students Present: \$\{formatPresenceValue\(ctx\.parsed\.y \|\| 0\)\}/);
  assert.match(text, /Campus: \$\{selectedFilterLabel\('spCampusScope'/);
});

test('reports use standardized methodology and metric definitions', () => {
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const utils = fs.readFileSync(path.join(__dirname, '..', 'js/shared/utils.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  ['Purpose', 'Metrics Used', 'Calculation Rules', 'Assumptions', 'Limitations'].forEach(heading => {
    assert.match(analytics, new RegExp(`<h4>${heading}<\\/h4>`));
    assert.match(utils, new RegExp(`<h4>${heading}<\\/h4>`));
  });
  [
    'Campus Choice Count',
    'Course Choice Count',
    'GE Choice Count',
    'Subject Breadth Count',
    'Seat Choice Count',
    'Modality Choice Count',
    'Choice Diversity Index',
    'Student Presence',
    'Sections Active',
    'Seats Offered',
    'Enrollment Present',
    'Fill Rate',
    'Waitlist Pressure',
    'Empty Seats',
    'Faculty Count',
    'LHE',
    'Prime-Time Concentration',
    'Choice Gap',
    'Hidden Demand',
    'Oversupply',
    'Expansion Candidate',
    'Consolidation Candidate'
  ].forEach(metric => assert.match(utils, new RegExp(metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.match(utils, /Census enrollment is preferred when available/);
  assert.match(utils, /Reports show evidence-informed patterns, not proof of student preference/);
  assert.match(app, /renderSchedulingAnalysisMethodologyPanels/);
  ['heatmap-standard-methodology', 'utilization-standard-methodology', 'modality-standard-methodology', 'linechart-standard-methodology'].forEach(id => {
    assert.match(index, new RegExp(`id="${id}"`));
  });
});

test('dashboard compact tables use short headers and nowrap CSS', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /currentEnrollment: 'Current'/);
  assert.match(text, /expectedEnrollment: 'Expected'/);
  assert.match(text, /estimatedFtesImpact: 'FTES Impact'/);
  assert.match(text, /function registrationPaceMonitorHtml/);
  assert.match(text, /Registration Pace by Campus/);
  assert.match(text, /Registration Pace by Modality/);
  assert.match(text, /Registration Pace by Time Block/);
  assert.match(text, /Registration Pace by Day Pattern/);
  assert.match(text, /Registration Pace by Division/);
  assert.match(text, /Asynchronous\/TBA/);
  assert.match(text, /function paceStatusBadge/);
  assert.match(text, /'Ahead of Pace': 'Ahead'/);
  assert.match(text, /'On Pace': 'Near Target'/);
  assert.match(text, /'Behind Pace': 'Behind'/);
  assert.match(text, /dashboard-status-badge/);
  assert.match(text, /sameModalitySeats: 'Same Mod\.'/);
  assert.match(text, /availableReceivingCapacity: 'Receiving Cap\.'/);
  assert.match(text, /studentsPresent: 'Students'/);
  assert.match(text, /availableRoomCapacity: 'Open Cap\.'/);
  assert.match(text, /title="\$\{escapeAttr\(full\)\}"/);
  assert.match(text, /aria-label="\$\{escapeAttr\(full\)\}"/);
  assert.match(text, /white-space:nowrap/);
  assert.match(text, /overflow-x:auto/);
  assert.doesNotMatch(text, /dashboard-panel th,\\.dashboard-panel td\\{overflow-wrap:anywhere/);
});

test('index owns enrollment analytics script order', () => {
  const root = path.join(__dirname, '..');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const parser = fs.readFileSync(path.join(root, 'js/parser.js'), 'utf8');
  const expectedOrder = [
    'js/config.js',
    'js/core/dom-utils.js',
    'js/core/csv-normalizer.js',
    'js/core/faculty-utils.js',
    'js/core/faculty-model.js',
    'js/core/faculty-parser.js',
    'js/core/section-model.js',
    'js/core/metric-definitions.js',
    'js/core/metric-help.js',
    'js/shared/utils.js',
    'js/admin.js',
    'js/availability.js',
    'js/heatmap.js',
    'js/modality.js',
    'js/utilization.js',
    'js/parser.js',
    'js/cal_getc_mapping.js',
    'js/curriculum_crosswalk.js',
    'js/roomCatalog.js',
    'js/app.js',
    'js/enrollment/metrics.js',
    'js/enrollment/filters.js',
    'js/enrollment/consolidation.js',
    'js/enrollment/dashboard.js',
    'js/enrollment-analytics.js'
  ];
  const positions = expectedOrder.map(script => index.indexOf(`src="${script}"`));

  assert.equal(positions.every(position => position >= 0), true);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal(parser.includes('loadScriptOnce'), false);
  assert.equal(parser.includes('js/enrollment-analytics.js'), false);
});
