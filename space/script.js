/* global visualThemeColors */
/* global intersect */
/* global saveAs */

let svgNameSpace;
let bootLoadingSpinnerElement;
let spaceRootElement;
let spaceBackElement;
let spaceForwardElement;
let spaceMapElement;
let steeringElement;
let handleSpacemapChanged = function() {};
let handleSteeringChanged = function() {};

// state variables to save/load
let masterKnoxelId;
let spacemapKnoxelId;
const knyteVectors = {}; // knyte id --> {initialKnyteId, terminalKnyteId}
const knoxelVectors = {}; // knoxel id --> {initialKnoxelId, terminalKnoxelId}
const knyteConnects = {}; // knyte id --> {knyte id: true}
const knyteInitialConnects = {}; // knyte id --> {knyte id: true}
const knyteTerminalConnects = {}; // knyte id --> {knyte id: true}
const informationMap = {}; // knyte id --> {color, space: {knoxel id --> position}, record: {data, viewertype, size}}
const knoxels = {}; // knoxel id --> knyte id
const knoxelViews = {}; // knoxel id --> {collapse, color}

// state variables to reset on load
const knyteEvalCode = {}; // knyte id --> eval key --> function made from parameters and code
const arrows = {}; // arrow id --> {initialKnoxelId, terminalKnoxelId}
const spaceBackStack = []; // [previous space root knoxel id]
const steeringBackStack = []; // [previous space root steering]
const spaceForwardStack = []; // [next space root knoxel id]
const steeringForwardStack = []; // [next space root steering]

// global settings
let runBlockDelay = 0;
const runBlockBusyList = {};
const useCtrlInsteadOfMeta = navigator.appVersion.indexOf('Mac') < 0; // for 'Win' and 'Linux'
const inputOptions = {
  handleMouseClick: true,
  handleKeyPress: true,
};
const inputCodeMap = {};

MouseEvent.prototype.cmdKey = function()
{
  return useCtrlInsteadOfMeta ? this.ctrlKey : this.metaKey;
}
KeyboardEvent.prototype.cmdKey = function()
{
  return useCtrlInsteadOfMeta ? this.ctrlKey : this.metaKey;
}

const visualTheme = {
  rect: {
    strokeWidth: 4,
    selfcontained: {
      dashLength: 8,
    },
    pictograph: {
      strokeWidth: 2,
    },
    fillColor: visualThemeColors.fill,
    defaultWidth: 32,
    defaultHeight: 32,
  },
  arrow: {
    strokeWidth: 3,
    defaultLength: 6,
    defaultWidth: 10,
    defaultHeight: 10,
  },
  recursive: {
    strokeWidth: 2,
  },
  knoxel: {
    defaultColor: visualThemeColors.stroke,
  },
  frame: {
    color: visualThemeColors.frame,
  },
  navigation: {
    strokeColor: visualThemeColors.control,
    fillColor: visualThemeColors.navigation,
  },
  getRandomColor: function() {
    const colors = visualThemeColors.elements;
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  },
};

const knit = new function()
{
  // Pre-calculate toString(16) for speed
  const hexBytes = [];
  for (let i = 0; i < 256; i++)
    hexBytes[i] = (i + 0x100).toString(16).substr(1);

  function binUuidV4(empty) {
    const b = new Uint8Array(16);
    if (!empty)
      crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return b;
  }

  function textUuidV4(empty) {
    const b = binUuidV4(empty);
    return hexBytes[b[0]] + hexBytes[b[1]] +
      hexBytes[b[2]] + hexBytes[b[3]] + '-' +
      hexBytes[b[4]] + hexBytes[b[5]] + '-' +
      hexBytes[b[6]] + hexBytes[b[7]] + '-' +
      hexBytes[b[8]] + hexBytes[b[9]] + '-' +
      hexBytes[b[10]] + hexBytes[b[11]] +
      hexBytes[b[12]] + hexBytes[b[13]] +
      hexBytes[b[14]] + hexBytes[b[15]];
  }
  // singleton properties
  this.empty = textUuidV4(true);
  this.new = function() {return textUuidV4();};
}

const steeringGear = new function()
{
  const panSpeed = 0.4;
  const zoomScale = 0.4;
  const zoomNormalization = 1.0 / 360.0;
  
  this.setCTM = function(matrix) // CTM - current transform matrix
  {
    const s = 'matrix(' +
      matrix.a + ',' + matrix.b + ',' + matrix.c + ',' + 
      matrix.d + ',' + matrix.e + ',' + matrix.f +
    ')';
    steeringElement.setAttribute('transform', s);
  };

  this.getCTM = function()
  {
    return steeringElement.getCTM();
  }
  
  this.screenToSpacePosition = function(screenPosition)
  {
    const p = spaceRootElement.createSVGPoint();
    p.x = screenPosition.x;
    p.y = screenPosition.y;
    const {x, y} = p.matrixTransform(this.getCTM().inverse());
    return {x, y};
  };

  this.spaceToScreenPosition = function(position)
  {
    const p = spaceRootElement.createSVGPoint();
    p.x = position.x;
    p.y = position.y;
    const {x, y} = p.matrixTransform(this.getCTM());
    return {x, y};
  };

  this.pan = function(delta, noSpeedCorrection)
  {
    const ctm = this.getCTM().inverse();
    const speed = noSpeedCorrection ? 1.0 : panSpeed;
    delta.x *= speed * ctm.a;
    delta.y *= speed * ctm.a;
    this.setCTM(ctm.inverse().translate(delta.x, delta.y));
    handleSteeringChanged();
  };

  this.zoom = function(position, delta)
  {
    const z = Math.pow(1 + zoomScale, zoomNormalization * delta);
    var p = this.screenToSpacePosition(position);
    // Compute new scale matrix in current mouse position
    var k = spaceRootElement.createSVGMatrix().translate(p.x, p.y).
      scale(z).translate(-p.x, -p.y);
    this.setCTM(this.getCTM().multiply(k));
    handleSteeringChanged();
  };

  this.setPan = function(offset)
  {
    const ctm = this.getCTM();
    ctm.e = offset.x;
    ctm.f = offset.y;
    this.setCTM(ctm);
    handleSteeringChanged();
  };

  this.setZoom = function(zoom)
  {
    const scale = 1.0 / zoom;
    const ctm = this.getCTM();
    ctm.a = scale;
    ctm.d = scale;
    this.setCTM(ctm);
    handleSteeringChanged();
  };

  this.getZoom = function(element)
  {
    return 1.0 / (element ? element : this).getCTM().a;
  }

  this.getPan = function(element)
  {
    const ctm = (element ? element : this).getCTM();
    return {x: ctm.e, y: ctm.f};
  }
}

function checkAppBusy()
{
  if (Object.keys(runBlockBusyList).length > 0)
  {
    alert('Can\'t save/load/upload state while code is running.\nPlease, stop all active flows first.')
    return false;
  }
  return true;
}

async function saveAppState(desc, fastMode)
{
  // desc: {owner, repo, pat, fileSHA}

  function checkInformationMapSpaces()
  {
    for (let knyteId in informationMap)
    {
      const {space} = informationMap[knyteId];
      for (let knoxelId in space)
      {
        const position = space[knoxelId];
        if (position instanceof SVGPoint)
        {
          console.warn('illegal position of ' + knoxelId + ' at ' + knyteId + ' space');
          space[knoxelId] = {x: position.x, y: position.y};
        }
      }
    }
  }

  if (!checkAppBusy())
    return;
  checkInformationMapSpaces();
  const state = {masterKnoxelId, spacemapKnoxelId, knyteVectors, knoxelVectors,
    knyteConnects, knyteInitialConnects, knyteTerminalConnects, informationMap, knoxels, knoxelViews};
  let stateText;
  if (fastMode)
  {
    stateText = JSON.stringify(state);
  }
  else
  {
    const keys = [];
    const keyMap = {};
    JSON.stringify(state, 
      (key, value) => {if (!(key in keyMap)) {keyMap[key] = true; keys.push(key);} return value;}
    );
    stateText = JSON.stringify(state, keys.sort(), '\t');
  }
  if (desc)
  {
    const message = prompt('Comment for changes:');
    if (message === null)
      return;
    if (message === '')
    {
      alert('Unable upload without comment.');
      return;
    }
    const success = await putRepoFile(desc.owner, desc.repo, desc.pat, message, stateText, desc.fileSHA);
    if (!success)
      alert('Failed to upload appstate to repo.');
  }
  else
  {
    const timestamp = Date.now();
    const min = fastMode ? '.min' : '';
    const knyteAppstateTemplate = `knyte-appstate.${timestamp}${min}.json`;
    const blob = new Blob([stateText], {type: 'text/plain;charset=utf-8'});
    saveAs(blob, knyteAppstateTemplate, true);
  }
}

async function loadAppState(desc)
{
  // desc: {files, fileSHA}

  function assignAppState(state)
  {
    function assignObject(source, destination)
    {
      for (let key in destination)
        delete destination[key];
      for (let key in source)
        destination[key] = source[key];
    }

    function checkInformationMapSpaces()
    {
      for (let knyteId in informationMap)
      {
        const {space} = informationMap[knyteId];
        for (let knoxelId in space)
        {
          const position = space[knoxelId];
          if (position.x === undefined || position.y === undefined)
          {
            console.warn('invalid position of ' + knoxelId + ' at ' + knyteId + ' space');
            space[knoxelId] = {x: 0, y: 0};
          }
        }
      }
    }

    masterKnoxelId = state.masterKnoxelId;
    spacemapKnoxelId = state.spacemapKnoxelId;
    assignObject(state.knyteVectors, knyteVectors);
    assignObject(state.knoxelVectors, knoxelVectors);
    assignObject(state.knyteConnects, knyteConnects);
    assignObject(state.knyteInitialConnects, knyteInitialConnects);
    assignObject(state.knyteTerminalConnects, knyteTerminalConnects);
    assignObject(state.informationMap, informationMap);
    assignObject(state.knoxels, knoxels);
    assignObject(state.knoxelViews, knoxelViews);
    for (let key in knyteEvalCode)
      delete knyteEvalCode[key];
    for (let key in arrows)
      delete arrows[key];
    spaceBackStack.length = 0;
    steeringBackStack.length = 0;
    spaceForwardStack.length = 0;
    steeringForwardStack.length = 0;
    checkInformationMapSpaces();
  }

  function onAppStateLoaded(state)
  {
    assignAppState(state);
    setSpaceRootKnoxel({knoxelId: masterKnoxelId}); // +++0
    steeringGear.setPan({x: 0, y: 0});
    handleSpacemapChanged();
    setNavigationControlState({});
  }

  if (!checkAppBusy())
    return;
  if (desc.files)
  {
    // TODO: implement files count and format check
    const file = desc.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const state = JSON.parse(e.target.result);
      onAppStateLoaded(state)
    };
    reader.readAsText(file);
  }
  else if (desc.fileSHA)
  {
    const stateText = await fetchRepoFile(desc.fileSHA);
    if (stateText)
    {
      const state = JSON.parse(stateText); // TODO: implement json format check
      onAppStateLoaded(state);
    }
    else
      alert('Failed to load appstate from repo.');
  }
}

function updateKnyteConnects(knyteId, connectType, connectOperation, connectKnyteId)
{
  if (!knyteId || !connectKnyteId)
    return;
  if (connectType === 'initial')
  {
    if (connectOperation === 'add')
    {
      knyteConnects[knyteId][connectKnyteId] = true;
      knyteInitialConnects[knyteId][connectKnyteId] = true;
    }
    else if (connectOperation === 'remove')
    {
      delete knyteConnects[knyteId][connectKnyteId];
      delete knyteInitialConnects[knyteId][connectKnyteId];
    }
  }
  else if (connectType === 'terminal')
  {
    if (connectOperation === 'add')
    {
      knyteConnects[knyteId][connectKnyteId] = true;
      knyteTerminalConnects[knyteId][connectKnyteId] = true;
    }
    else if (connectOperation === 'remove')
    {
      delete knyteConnects[knyteId][connectKnyteId];
      delete knyteTerminalConnects[knyteId][connectKnyteId];
    }
  }
}

function addKnyte(desc)
{
  // desc: {knyteId, initialKnyteId, terminalKnyteId, color}
  knyteVectors[desc.knyteId] = {
    initialKnyteId: desc.initialKnyteId,
    terminalKnyteId: desc.terminalKnyteId
  };
  knyteConnects[desc.knyteId] = {};
  knyteInitialConnects[desc.knyteId] = {};
  knyteTerminalConnects[desc.knyteId] = {};
  updateKnyteConnects(desc.initialKnyteId, 'initial', 'add', desc.knyteId);
  updateKnyteConnects(desc.terminalKnyteId, 'terminal', 'add', desc.knyteId);
  informationMap[desc.knyteId] = {color: desc.color, space: {}};
}

function addKnoxel(desc)
{
  // desc: {hostKnyteId, knyteId, knoxelId, position, collapse, color}
  knoxels[desc.knoxelId] = desc.knyteId;
  knoxelViews[desc.knoxelId] = {collapse: desc.collapse || false, color: desc.color || visualTheme.knoxel.defaultColor};
  if (desc.hostKnyteId)
    informationMap[desc.hostKnyteId].space[desc.knoxelId] = desc.position;
}

const knoxelRect = new function()
{
  function computeArrowShape(w, h, x, y, knoxelId, hostKnyteId, arrowStrokeWidth, ghost)
  {
    const hostSpace = informationMap[hostKnyteId].space;
    const endpoints = knoxelVectors[knoxelId];
    const l = visualTheme.arrow.defaultLength;
    const {x1, y1, x2, y2, x3, y3, initialCross, terminalCross} = endpoints
      ? getArrowPointsByKnoxels({arrowSpace: hostSpace, jointKnoxelId: knoxelId,
        initialKnoxelId: endpoints.initialKnoxelId, terminalKnoxelId: endpoints.terminalKnoxelId,
        x, y, w, h, arrowStrokeWidth, ghost})
      : {x1: (w - l)/2, y1: h/2, x2: w/2, y2: h/2, x3: (w + l)/2, y3: h/2, initialCross: false, terminalCross: false};
    return {x1, y1, x2, y2, x3, y3, initialCross, terminalCross};
  }
  
  function getFigureDimensions(knoxelId, knyteTrace, bubble)
  {
    const leftTop = {x: 0, y: 0};
    const knyteId = knoxels[knoxelId];
    const rects = [];
    const arrows = {};
    const knoxelIdToRectId = {};
    let type = 'recursive';
    if (knyteId === knoxels[spacemapKnoxelId])
      type = 'spacemap';
    else if (knyteId in knyteTrace)
      type = 'selfviewed';
    else if (knoxelViews[knoxelId].collapse)
      type = 'collapse';
    const isArrow = type === 'recursive' && !bubble && (knoxelId in knoxelVectors) &&
      (knoxelVectors[knoxelId].initialKnoxelId || knoxelVectors[knoxelId].terminalKnoxelId);
    let w = isArrow ? visualTheme.arrow.defaultWidth : visualTheme.rect.defaultWidth;
    let h = isArrow ? visualTheme.arrow.defaultHeight : visualTheme.rect.defaultHeight;
    if (type === 'recursive')
    {
      let left = 1000000, right = -1000000, top = 1000000, bottom = -1000000; // TODO: use more generic approach
      const {space, record} = informationMap[knyteId];
      if (record && record.size)
      {
        w = Math.max(w, record.size.w);
        h = Math.max(h, record.size.h);
        left = 0;
        right = w;
        top = 0;
        bottom = h;
      }
      const mx = visualTheme.rect.defaultWidth/2;
      const my = visualTheme.rect.defaultHeight/2;
      const nestedKnyteTrace = Object.assign({}, knyteTrace);
      nestedKnyteTrace[knyteId] = true;
      for (let nestedKnoxelId in space)
      {
        const rectId = knit.new();
        knoxelIdToRectId[nestedKnoxelId] = rectId;
        const nestedKnyteId = knoxels[nestedKnoxelId];
        let nestedType = 'recursive';
        if (nestedKnyteId === knoxels[spacemapKnoxelId])
          nestedType = 'spacemap';
        else if (nestedKnyteId in nestedKnyteTrace)
          nestedType = 'selfviewed';
        else if (knoxelViews[nestedKnoxelId].collapse)
          nestedType = 'collapse';
        const d = getFigureDimensions(nestedKnoxelId, nestedKnyteTrace);
        const nestedW = d.w;
        const nestedH = d.h;
        const {x, y} = space[nestedKnoxelId];
        const {color, record} = informationMap[nestedKnyteId];
        const strokeColor = knoxelViews[nestedKnoxelId].color;
        const nestedLeft = x - nestedW/2 - mx;
        const nestedRight = x + nestedW/2 + mx;
        const nestedTop = y - nestedH/2 - my;
        const nestedBottom = y + nestedH/2 + my;
        if (left > nestedLeft)
          left = nestedLeft;
        if (right < nestedRight)
          right = nestedRight;
        if (top > nestedTop)
          top = nestedTop;
        if (bottom < nestedBottom)
          bottom = nestedBottom;
        const nestedX = x - nestedW/2;
        const nestedY = y - nestedH/2;
        const {x1, y1, x2, y2, x3, y3, initialCross, terminalCross} = computeArrowShape(nestedW, nestedH, nestedX, nestedY,
          nestedKnoxelId, knyteId, visualTheme.recursive.strokeWidth, false);
        const r = {rectId, x: nestedX, y: nestedY, leftTop: d.leftTop, w: nestedW, h: nestedH, color, strokeColor, record, 
          x1, y1, x2, y2, x3, y3, initialCross, terminalCross, type: nestedType};
        rects.push(r);
        if (d.type === 'recursive')
        {
          for (let i = 0; i < d.rects.length; ++i)
          {
            const rr = d.rects[i];
            rects.push({rectId: rr.rectId, x: r.x + rr.x, y: r.y + rr.y, leftTop: rr.leftTop, w: rr.w, h: rr.h, 
              color: rr.color, strokeColor: rr.strokeColor, record: rr.record,
              x1: rr.x1, y1: rr.y1, x2: rr.x2, y2: rr.y2, x3: rr.x3, y3: rr.y3, type: rr.type});
          }
          for (let arrowId in d.arrows)
          {
            const ar = d.arrows[arrowId];
            arrows[arrowId] = {space: ar.space, knoxelId: ar.knoxelId, initialKnoxelId: ar.initialKnoxelId,
              terminalKnoxelId: ar.terminalKnoxelId, initialRectId: ar.initialRectId, terminalRectId: ar.terminalRectId};
          }
        }
      }
      for (let nestedKnoxelId in space)
      {
        const vector = knoxelVectors[nestedKnoxelId];
        if (vector)
          arrows[knoxelIdToRectId[nestedKnoxelId]] = {
            space,
            knoxelId: nestedKnoxelId,
            initialKnoxelId: vector.initialKnoxelId,
            terminalKnoxelId: vector.terminalKnoxelId,
            initialRectId: knoxelIdToRectId[vector.initialKnoxelId], 
            terminalRectId: knoxelIdToRectId[vector.terminalKnoxelId]
          };
      }
      if (left < right && top < bottom)
      {
        w = Math.max(w, right - left);
        h = Math.max(h, bottom - top);
        leftTop.x = left;
        leftTop.y = top;
        for (let i = 0; i < rects.length; ++i)
        {
          rects[i].x -= left;
          rects[i].y -= top;
        }
      }
    }
    else
    {
      const {color, record} = informationMap[knyteId];
      const strokeColor = knoxelViews[knoxelId].color;
      const r = {x: 0, y: 0, leftTop, w, h, color, strokeColor, record, type};
      rects.push(r);
    }
    return {w, h, leftTop, rects, arrows, type};
  }

  this.add = function(desc)
  {
    // desc: {knoxelId, position, ghost, bubble, selfcontained}
    
    function createRectShape(desc)
    {
      // desc: {w, h, color, strokeWidth, strokeColor}
      const rect = document.createElementNS(svgNameSpace, 'rect');
      rect.setAttribute('width', desc.w);
      rect.setAttribute('height', desc.h);
      rect.setAttribute('fill', desc.color);
      rect.setAttribute('stroke', desc.strokeColor);
      rect.setAttribute('stroke-width', desc.strokeWidth);
      return rect;
    }
    
    function createForeignObject(desc)
    {
      // desc: {x, y, record}
      const info = document.createElementNS(svgNameSpace, 'foreignObject');
      info.setAttribute('x', desc.x);
      info.setAttribute('y', desc.y);
      const {w, h} = desc.record && desc.record.size ? desc.record.size : {w: 0, h: 0};
      info.setAttribute('width', w);
      info.setAttribute('height', h);
      info.innerHTML = recordViewers[desc.record.viewertype](desc.record.data);
      return info;
    }
    
    function createArrowShape(desc)
    {
      // desc: {x1, y1, x2, y2, x3, y3, initialCross, terminalCross, strokeWidth, strokeColor}
      const arrow = document.createElementNS(svgNameSpace, 'polyline');
      const p1 = spaceRootElement.createSVGPoint();
      const p2 = spaceRootElement.createSVGPoint();
      const p3 = spaceRootElement.createSVGPoint();
      p1.x = desc.x1;
      p1.y = desc.y1;
      p2.x = desc.x2;
      p2.y = desc.y2;
      p3.x = desc.x3;
      p3.y = desc.y3;
      arrow.points.appendItem(p1);
      arrow.points.appendItem(p2);
      arrow.points.appendItem(p3);
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke', desc.strokeColor);
      arrow.setAttribute('stroke-width', desc.strokeWidth);
      arrow.setAttribute('marker-start', desc.initialCross ? 'url(#crossTail)' : 'url(#arrowTail)');
      arrow.setAttribute('marker-end', desc.terminalCross ? 'url(#crossHead)' : 'url(#arrowHead)');
      return arrow;
    }

    function createShapes(rects, arrows, rootType)
    {
      const result = [];
      for (let i = 0; i < rects.length; ++i)
      {
        const rectGroup = document.createElementNS(svgNameSpace, 'g');
        const r = rects[i];
        if (rootType === 'recursive')
        {
          rectGroup.setAttribute('transform', 'translate(' + r.x + ' ' + r.y + ')');
          const arrow = createArrowShape({x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, x3: r.x3, y3: r.y3,
            initialCross: r.initialCross, terminalCross: r.terminalCross, strokeWidth: visualTheme.recursive.strokeWidth,
            strokeColor: r.strokeColor});
          if (r.rectId) arrow.id = r.rectId + '.arrow';
          rectGroup.appendChild(arrow); // TODO: hide arrow if useless for visualisation
          const rect = createRectShape({w: r.w, h: r.h, color: r.color, strokeWidth: visualTheme.recursive.strokeWidth,
            strokeColor: r.strokeColor});
          if (r.rectId) rect.id = r.rectId + '.rect';
          rectGroup.appendChild(rect);
          if (r.type === 'recursive' && r.record)
          {
            const infoPosition = {x: -r.leftTop.x, y: -r.leftTop.y};
            const info = createForeignObject({x: infoPosition.x, y: infoPosition.y, record: r.record});
            rectGroup.appendChild(info);
          }
        }
        if (r.type === 'selfviewed')
        {
          const circle = document.createElementNS(svgNameSpace, 'circle');
          circle.setAttribute('cx', 16);
          circle.setAttribute('cy', 16);
          circle.setAttribute('r', 8);
          circle.setAttribute('stroke', '#160f19');
          circle.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle.setAttribute('fill', 'transparent');
          circle.style.pointerEvents = 'none';
          rectGroup.appendChild(circle);
        }
        else if (r.type === 'spacemap')
        {
          const circle1 = document.createElementNS(svgNameSpace, 'circle');
          circle1.setAttribute('cx', 10);
          circle1.setAttribute('cy', 10);
          circle1.setAttribute('r', 4);
          circle1.setAttribute('stroke', '#160f19');
          circle1.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle1.setAttribute('fill', '#d8b621');
          circle1.style.pointerEvents = 'none';
          const circle2 = document.createElementNS(svgNameSpace, 'circle');
          circle2.setAttribute('cx', 22);
          circle2.setAttribute('cy', 10);
          circle2.setAttribute('r', 4);
          circle2.setAttribute('stroke', '#160f19');
          circle2.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle2.setAttribute('fill', '#dc286f');
          circle2.style.pointerEvents = 'none';
          const circle3 = document.createElementNS(svgNameSpace, 'circle');
          circle3.setAttribute('cx', 10);
          circle3.setAttribute('cy', 22);
          circle3.setAttribute('r', 4);
          circle3.setAttribute('stroke', '#160f19');
          circle3.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle3.setAttribute('fill', '#36945b');
          circle3.style.pointerEvents = 'none';
          const circle4 = document.createElementNS(svgNameSpace, 'circle');
          circle4.setAttribute('cx', 22);
          circle4.setAttribute('cy', 22);
          circle4.setAttribute('r', 4);
          circle4.setAttribute('stroke', '#160f19');
          circle4.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle4.setAttribute('fill', '#5571f1');
          circle4.style.pointerEvents = 'none';
          rectGroup.appendChild(circle1);
          rectGroup.appendChild(circle2);
          rectGroup.appendChild(circle3);
          rectGroup.appendChild(circle4);
        }
        else if (r.type === 'collapse')
        {
          const circle1 = document.createElementNS(svgNameSpace, 'circle');
          circle1.setAttribute('cx', 7);
          circle1.setAttribute('cy', 16);
          circle1.setAttribute('r', 3);
          circle1.setAttribute('stroke', '#160f19');
          circle1.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle1.setAttribute('fill', 'transparent');
          circle1.style.pointerEvents = 'none';
          const circle2 = document.createElementNS(svgNameSpace, 'circle');
          circle2.setAttribute('cx', 16);
          circle2.setAttribute('cy', 16);
          circle2.setAttribute('r', 3);
          circle2.setAttribute('stroke', '#160f19');
          circle2.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle2.setAttribute('fill', 'transparent');
          circle2.style.pointerEvents = 'none';
          const circle3 = document.createElementNS(svgNameSpace, 'circle');
          circle3.setAttribute('cx', 25);
          circle3.setAttribute('cy', 16);
          circle3.setAttribute('r', 3);
          circle3.setAttribute('stroke', '#160f19');
          circle3.setAttribute('stroke-width', visualTheme.rect.pictograph.strokeWidth);
          circle3.setAttribute('fill', 'transparent');
          circle3.style.pointerEvents = 'none';
          rectGroup.appendChild(circle1);
          rectGroup.appendChild(circle2);
          rectGroup.appendChild(circle3);
        }
        result.push(rectGroup);
      }
      return result;
    }
    
    function updateArrowShapes(arrows, ghost)
    {
      for (let id in arrows)
      {
        const arrowId = id + '.arrow';
        const arrowShape = document.getElementById(arrowId);
        if (!arrowShape)
          continue;
        const rectId = id + '.rect';
        const initialRectId = arrows[id].initialRectId + '.rect';
        const terminalRectId = arrows[id].terminalRectId + '.rect';
        const {space, knoxelId, initialKnoxelId, terminalKnoxelId} = arrows[id];
        const arrowStrokeWidth = visualTheme.recursive.strokeWidth;
        const {x1, y1, x2, y2, x3, y3, initialCross, terminalCross} = getArrowPointsByRects({arrowSpace: space,
          jointKnoxelId: knoxelId, initialKnoxelId, terminalKnoxelId, rectId, initialRectId, terminalRectId, arrowStrokeWidth, ghost});
        arrowShape.points.getItem(0).x = x1;
        arrowShape.points.getItem(0).y = y1;
        arrowShape.points.getItem(1).x = x2;
        arrowShape.points.getItem(1).y = y2;
        arrowShape.points.getItem(2).x = x3;
        arrowShape.points.getItem(2).y = y3;
        arrowShape.setAttribute('marker-start', initialCross ? 'url(#crossTail)' : 'url(#arrowTail)');
        arrowShape.setAttribute('marker-end', terminalCross ? 'url(#crossHead)' : 'url(#arrowHead)');
      }
    }
    
    function createFigure(desc)
    {
      // desc: {knoxelId, position, ghost, bubble, selfcontained}
      const knyteId = knoxels[desc.knoxelId];
      const {color, record} = informationMap[knyteId];
      const strokeColor = knoxelViews[desc.knoxelId].color;
      const knyteTrace = {};
      const hostKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
      knyteTrace[hostKnyteId] = true;
      const {w, h, leftTop, rects, arrows, type} = getFigureDimensions(desc.knoxelId, knyteTrace, desc.bubble);
      const knoxelVector = knoxelVectors[desc.knoxelId];
      const hasEndpoints = knoxelVector && (knoxelVector.initialKnoxelId || knoxelVector.terminalKnoxelId); 
      const rectGroup = document.createElementNS(svgNameSpace, 'g');
      rectGroup.id = desc.knoxelId;
      rectGroup.classList.value = 'mouseOverRect';
      const x = desc.position.x - w/2;
      const y = desc.position.y - h/2;
      if (!desc.ghost && !desc.bubble)
      {
        rectGroup.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      }
      else
      {
        const {x, y} = desc.position;
        rectGroup.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
        const scale = 1.0/steeringGear.getZoom();
        const hostElement = document.getElementById(desc.ghost ? 'ghosts' : 'bubbles');
        hostElement.setAttribute('transform', 'scale(' + scale + ')');
      }
      if (!desc.bubble && hasEndpoints)
      {
        const {x1, y1, x2, y2, x3, y3, initialCross, terminalCross} = computeArrowShape(
          w, h, x, y, desc.knoxelId, hostKnyteId, visualTheme.arrow.strokeWidth, false);
        const arrowRoot = createArrowShape({x1, y1, x2, y2, x3, y3, initialCross, terminalCross, 
          strokeWidth: visualTheme.arrow.strokeWidth, strokeColor});
        arrowRoot.id = desc.knoxelId + '.arrow';
        if (desc.ghost)
        {
          arrowRoot.id += '.ghost';
          const {x, y} = desc.position;
          arrowRoot.setAttribute('transform', 'translate(' + (-x) + ' ' + (-y) + ')');
        }
        rectGroup.appendChild(arrowRoot); // TODO: hide arrow if useless for visualisation
      }
      const rectRoot = createRectShape({w, h, color, strokeWidth: visualTheme.rect.strokeWidth, strokeColor});
      rectGroup.appendChild(rectRoot);
      if (desc.selfcontained)
      {
        const dirLength = Math.sqrt(w*w + h*h);
        const dir = {x: w/dirLength, y: h/dirLength};
        const d = visualTheme.rect.selfcontained.dashLength;
        const selfcontainedLine1 = document.createElementNS(svgNameSpace, 'line');
        selfcontainedLine1.setAttribute('x1', -d*dir.x);
        selfcontainedLine1.setAttribute('y1', -d*dir.y);
        selfcontainedLine1.setAttribute('x2', 0);
        selfcontainedLine1.setAttribute('y2', 0);
        selfcontainedLine1.setAttribute('stroke', strokeColor);
        selfcontainedLine1.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        const selfcontainedLine2 = document.createElementNS(svgNameSpace, 'line');
        selfcontainedLine2.setAttribute('x1', w);
        selfcontainedLine2.setAttribute('y1', h);
        selfcontainedLine2.setAttribute('x2', (d+dirLength)*dir.x);
        selfcontainedLine2.setAttribute('y2', (d+dirLength)*dir.y);
        selfcontainedLine2.setAttribute('stroke', strokeColor);
        selfcontainedLine2.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        const selfcontainedLine3 = document.createElementNS(svgNameSpace, 'line');
        selfcontainedLine3.setAttribute('x1', -d*dir.x);
        selfcontainedLine3.setAttribute('y1', (d+dirLength)*dir.y);
        selfcontainedLine3.setAttribute('x2', 0);
        selfcontainedLine3.setAttribute('y2', h);
        selfcontainedLine3.setAttribute('stroke', strokeColor);
        selfcontainedLine3.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        const selfcontainedLine4 = document.createElementNS(svgNameSpace, 'line');
        selfcontainedLine4.setAttribute('x1', w);
        selfcontainedLine4.setAttribute('y1', 0);
        selfcontainedLine4.setAttribute('x2', (d+dirLength)*dir.x);
        selfcontainedLine4.setAttribute('y2', -d*dir.y);
        selfcontainedLine4.setAttribute('stroke', strokeColor);
        selfcontainedLine4.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        rectGroup.appendChild(selfcontainedLine1);
        rectGroup.appendChild(selfcontainedLine2);
        rectGroup.appendChild(selfcontainedLine3);
        rectGroup.appendChild(selfcontainedLine4);
      }
      if (record && type === 'recursive')
      {
        const infoPosition = {x: -leftTop.x, y: -leftTop.y};
        const info = createForeignObject({x: infoPosition.x, y: infoPosition.y, record});
        rectGroup.appendChild(info);
      }
      const shapes = createShapes(rects, arrows, type);
      for (let i = 0; i < shapes.length; ++i)
        rectGroup.appendChild(shapes[i]);
      setTimeout(updateArrowShapes, 0, arrows, desc.ghost);
      if (desc.ghost)
      {
        rectGroup.id += '.ghost';
        rectGroup.setAttribute('opacity', 0.5);
        rectGroup.style.pointerEvents = 'none';
        document.getElementById('ghosts').appendChild(rectGroup);
      }
      else if (desc.bubble)
      {
        rectGroup.id += '.bubble';
        rectGroup.setAttribute('opacity', 0.5);
        rectGroup.style.pointerEvents = 'none';
        rectRoot.setAttribute('stroke-dasharray', '0 16');
        rectRoot.setAttribute('stroke-linecap', 'square');
        document.getElementById('bubbles').appendChild(rectGroup);
      }
      else
      {
        rectGroup.addEventListener('click', onClickRect, false);
        document.getElementById('knoxels').appendChild(rectGroup);
      }
      return rectGroup.id;
    }
    
    return createFigure(desc);
  };
  
  this.updateArrowShape = function(knoxelId, position, ghost)
  {
    const postfix = '.arrow' + (ghost ? '.ghost' : '');
    const arrowShape = document.getElementById(knoxelId + postfix);
    if (!arrowShape)
      return;
    const knyteId = knoxels[knoxelId];
    const knyteTrace = {};
    const hostKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
    knyteTrace[hostKnyteId] = true;
    const {w, h} = getFigureDimensions(knoxelId, knyteTrace);
    const {x1, y1, x2, y2, x3, y3} = computeArrowShape(
      w, h, position.x, position.y, knoxelId, hostKnyteId, visualTheme.arrow.strokeWidth, ghost);
    arrowShape.points.getItem(0).x = x1;
    arrowShape.points.getItem(0).y = y1;
    arrowShape.points.getItem(1).x = x2;
    arrowShape.points.getItem(1).y = y2;
    arrowShape.points.getItem(2).x = x3;
    arrowShape.points.getItem(2).y = y3;
  }
  
  this.setDotted = function(desc)
  {
    // desc: {knoxelId, isDotted}
    let rectElement = document.getElementById(desc.knoxelId);
    let rectShape, arrowShape;
    if (rectElement.tagName === 'g')
    {
      let shape = rectElement.firstElementChild;
      while (shape)
      {
        if (shape.tagName === 'rect' && !rectShape)
          rectShape = shape;
        else if (shape.tagName === 'polyline' && !arrowShape)
          arrowShape = shape;
        shape = shape.nextElementSibling;
      }
    }
    if (!rectShape)
      console.error('failed dotting for knoxelId ' + desc.knoxelId);
    if (desc.isDotted)
    {
      rectShape.setAttribute('stroke-dasharray', '0 16');
      rectShape.setAttribute('stroke-linecap', 'square');
      if (arrowShape)
      {
        arrowShape.setAttribute('stroke-dasharray', '0 8');
        arrowShape.setAttribute('stroke-linecap', 'square');
      }
    }
    else
    {
      rectShape.removeAttribute('stroke-dasharray');
      rectShape.removeAttribute('stroke-linecap');
      if (arrowShape)
      {
        arrowShape.removeAttribute('stroke-dasharray');
        arrowShape.removeAttribute('stroke-linecap');
      }
    }
  };
  
  this.getElementSize = function(element, ghost)
  {
    let rectShape;
    if (element.tagName === 'g')
    {
      let shape = element.firstElementChild;
      while (shape)
      {
        if (shape.tagName === 'rect' && !rectShape)
          rectShape = shape;
        shape = shape.nextElementSibling;
      }
    }
    if (!rectShape)
      console.error('failed get size for element ' + element.id);
    let {width, height} = rectShape.getBoundingClientRect();
    if (!ghost)
    {
      const zoom = steeringGear.getZoom();
      width *= zoom;
      height *= zoom;
    }
    return {w: width, h: height};
  };
  
  this.moveElement = function(desc)
  {
    // desc: {element, x, y}
    const {w, h} = this.getElementSize(desc.element, true);
    const x = desc.x - w/2;
    const y = desc.y - h/2;
    const positioningElement = document.getElementById('positioning');
    positioningElement.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
  };
  
  this.getRootByTarget = function(targetElement)
  {
    if (targetElement === null)
      return null;
    let element = targetElement;
    while (element.classList.value !== 'mouseOverRect' && element !== spaceRootElement)
      element = element.parentElement;
    return element;
  };

  this.getKnoxelDimensions = function(knoxelId)
  {
    return getFigureDimensions(knoxelId, {});
  };
};

const knoxelSpaceRoot = new function()
{
  this.update = function()
  {
    const knoxelId = spaceRootElement.dataset.knoxelId;
    const knyteId = knoxels[knoxelId];
    const {color, record} = informationMap[knyteId];
    spaceRootElement.style.backgroundColor = color;
    const spaceRootRecord = document.getElementById('record');
    const foreignObject = spaceRootRecord.getElementsByTagName('foreignObject')[0];
    foreignObject.innerHTML = record && knoxelId !== spacemapKnoxelId ? recordViewers[record.viewertype](record.data) : '';
    const {w, h} = record && record.size ? record.size : {w: 0, h: 0};
    foreignObject.setAttribute('width', w);
    foreignObject.setAttribute('height', h);
  };
}

const knoxelArrow = new function()
{
  this.moveElement = function(desc)
  {
    // desc: {knoxelId, element, x, y}
    if (desc.element.tagName === 'line')
    {
      const spaceRootKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
      const space = informationMap[spaceRootKnyteId].space;
      if (!(desc.knoxelId in space))
      {
        desc.element.setAttribute('x1', desc.x + visualTheme.arrow.defaultLength);
        desc.element.setAttribute('y1', desc.y);
      }
      desc.element.setAttribute('x2', desc.x);
      desc.element.setAttribute('y2', desc.y);
    }
    else
      console.error('failed moving for knoxelId ' + desc.element.id);
  };
  this.updateElement = function(desc)
  {
    // desc: {knoxelId, element}
    const spaceRootKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
    const spacePosition = informationMap[spaceRootKnyteId].space[desc.knoxelId];
    if (!spacePosition)
      return;
    const originPosition = steeringGear.spaceToScreenPosition(spacePosition);
    desc.element.setAttribute('x1', originPosition.x);
    desc.element.setAttribute('y1', originPosition.y);
  };
  this.setDotted = function(desc)
  {
    // desc: {knoxelId, isDotted}
    let rectElement = document.getElementById(desc.knoxelId);
    let arrowShape;
    if (rectElement.tagName === 'g')
    {
      let shape = rectElement.firstElementChild;
      while (shape)
      {
        if (shape.tagName === 'polyline' && !arrowShape)
          arrowShape = shape;
        shape = shape.nextElementSibling;
      }
    }
    if (!arrowShape)
      return;
    if (desc.isDotted)
    {
      arrowShape.setAttribute('stroke-dasharray', '0 8');
      arrowShape.setAttribute('stroke-linecap', 'square');
    }
    else
    {
      arrowShape.removeAttribute('stroke-dasharray');
      arrowShape.removeAttribute('stroke-linecap');
    }
  };
}

const recordViewers = new function()
{
  this.oneliner = function(data)
  {
    return '<div style="display: flex; height: 100%; justify-content: center; align-items: center;">' +
      getHtmlFromText(data) + '</div>';
  };
  this.multiliner = function(data)
  {
    const padding = 2*visualTheme.rect.strokeWidth;
    return '<div style="white-space: pre; text-align: left; tab-size: 4; padding: ' + padding + 'px;">' +
      getHtmlFromText(data) + '</div>';
  };
  this.interactive = function(data)
  {
    return data;
  };
};

function setArrowGhostedMode(desc)
{
  // desc: {knoxelId, isGhosted}
  knoxelArrow.setDotted({knoxelId: desc.knoxelId, isDotted: desc.isGhosted});
}

function setGhostedMode(desc)
{
  // desc: {knoxelId, isGhosted}
  knoxelRect.setDotted({knoxelId: desc.knoxelId, isDotted: desc.isGhosted});
}

function setArrowBubbledMode(desc)
{
  // desc: {knoxelId, initial, terminal, isBubbled}
  const jointKnyteId = knoxels[desc.knoxelId];
  const endpoints = knyteVectors[jointKnyteId];
  const spaceRootKnoxels = document.getElementById('knoxels');
  let knoxelElement = spaceRootKnoxels.firstElementChild;
  while (knoxelElement)
  {
    const knoxelId = knoxelElement.id;
    const knyteId = knoxels[knoxelId];
    if (desc.initial && endpoints.initialKnyteId === knyteId)
      knoxelRect.setDotted({knoxelId, isDotted: desc.isBubbled});
    if (desc.terminal && endpoints.terminalKnyteId === knyteId)
      knoxelRect.setDotted({knoxelId, isDotted: desc.isBubbled});
    knoxelElement = knoxelElement.nextElementSibling;
  }
}

function setBubbledMode(desc)
{
  // desc: {knoxelId, knyteId, isBubbled}
  const spaceRootKnoxels = document.getElementById('knoxels');
  let knoxelElement = spaceRootKnoxels.firstElementChild;
  while (knoxelElement)
  {
    const knoxelId = knoxelElement.id;
    const knyteId = knoxels[knoxelId];
    if (knoxelId !== desc.knoxelId && knyteId === desc.knyteId)
      knoxelRect.setDotted({knoxelId, isDotted: desc.isBubbled});
    knoxelElement = knoxelElement.nextElementSibling;
  }
}

function setKnoxelColor(knoxelId, color)
{
  if (knoxelViews[knoxelId].color === color)
    return;
  knoxelViews[knoxelId].color = color;
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
}

function getKnoxelPosition(hostKnyteId, knoxelId)
{
  if (!(hostKnyteId in informationMap) || !(knoxelId in informationMap[hostKnyteId].space))
    return null;
  return informationMap[hostKnyteId].space[knoxelId];
}

function setKnoxelPosition(hostKnyteId, knoxelId, position)
{
  if (!(hostKnyteId in informationMap) || !(knoxelId in informationMap[hostKnyteId].space))
    return;
  const p = informationMap[hostKnyteId].space[knoxelId];
  if (p.x === position.x && p.y === position.y)
    return;
  p.x = position.x;
  p.y = position.y;
  const knoxelElement = document.getElementById(knoxelId);
  const {w, h} = knoxelRect.getKnoxelDimensions(knoxelId);
  let {x, y} = p;
  x -= w/2;
  y -= h/2;
  knoxelElement.setAttribute('transform', 'translate(' + x + ',' + y + ')');
}

function setKnoxelCollapse(knoxelId, collapse)
{
  if (knoxelViews[knoxelId].collapse === collapse)
    return;
  knoxelViews[knoxelId].collapse = collapse;
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
}

function getKnyteData(knyteId)
{
  if ((knyteId in informationMap) && informationMap[knyteId].record)
    return informationMap[knyteId].record.data;
  return undefined;
}

function setKnyteData(knyteId, newData)
{
  informationMap[knyteId].record = getOnelinerRecordByData(newData);
  // assume that knoxels of this knyte are out of the simulation space
  //setSpaceRootKnoxel({knoxelId}); // TODO: optimise space refresh
}

function handleCustomBlockEvent(api)
{
  function matchToken(data, token)
  {
    return data === token;
  }

  // find connected custom blocks by custom links
  const knyteId = knoxels[api.knoxelId];
  api.knyteId = knyteId;
  const customKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'custom', 'terminal');
  for (let i = 0; i < customKnytes.length; ++ i)
  {
    const customLinkKnyteId = customKnytes[i];
    const customKnyteId = customLinkKnyteId ? knyteVectors[customLinkKnyteId].initialKnyteId : undefined;
    const customRecord = customKnyteId ? informationMap[customKnyteId].record : undefined;
    let customCodeText = customRecord ? customRecord.data : '';
    // compile and run code of every custom block with api as the only parameter
    const useStrict = '"use strict";\n';
    const evalKey = 'custom' + customCodeText;
    const evalText = 'new Function("api", useStrict + customCodeText)';
    if (!(knyteId in knyteEvalCode))
      knyteEvalCode[knyteId] = {};
    if (!(evalKey in knyteEvalCode[knyteId]))
      knyteEvalCode[knyteId][evalKey] = eval(evalText);
    const codeFunction = knyteEvalCode[knyteId][evalKey];
    runBlockBusyList[knyteId] = true;
    let callComplete = false;
    try
    {
      codeFunction(api);
      callComplete = true;
      delete runBlockBusyList[knyteId];
    }
    finally
    {
      if (!callComplete)
      {
        delete runBlockBusyList[knyteId];
      }
    }
  }
  // TODO: handle all possible errors
}

function setSpaceRootKnoxel(desc)
{
  // desc: {knoxelId}
  const priorKnoxelId = spaceRootElement.dataset.knoxelId;
  const newKnoxelId = desc.knoxelId;
  // handle custom block leave
  handleCustomBlockEvent({event: 'leave', knoxelId: priorKnoxelId, inputCodeMap, inputOptions,
    setKnoxelColor, getKnoxelPosition, setKnoxelPosition, setKnoxelCollapse, getKnyteData, setKnyteData});
  // cleanup inputCodeMap
  if (priorKnoxelId !== newKnoxelId)
    for (let code in inputCodeMap)
      delete inputCodeMap[code];
  // terminate frame
  if (activeFrame.element && priorKnoxelId !== newKnoxelId)
    terminateFrameRect();
  // clear children rects
  const spaceRootKnoxels = document.getElementById('knoxels');
  while (spaceRootKnoxels.firstElementChild)
    spaceRootKnoxels.firstElementChild.remove();
  // set actual knoxel id, space color and information record
  spaceRootElement.dataset.knoxelId = newKnoxelId;
  knoxelSpaceRoot.update();
  // restore all nested rects
  const newKnyteId = knoxels[newKnoxelId];
  const nestedKnoxels = informationMap[newKnyteId].space;
  for (let knoxelId in nestedKnoxels)
  {
    const selfcontained = knoxelId === spaceRootElement.dataset.knoxelId;
    const position = nestedKnoxels[knoxelId];
    knoxelRect.add({knoxelId, position, selfcontained});
    if (knoxelId === activeGhost.knoxelId)
      setGhostedMode({knoxelId, isGhosted: true});
    if (knoxelId === activeInitialGhost.knoxelId || knoxelId === activeTerminalGhost.knoxelId)
      setArrowGhostedMode({knoxelId, isGhosted: true});
  }
  // update all arrows of nested rects
  for (let knoxelId in nestedKnoxels)
  {
    const position = nestedKnoxels[knoxelId];
    knoxelRect.updateArrowShape(knoxelId, position);
  }
  // restore bubble-mode view
  if (activeBubble.knoxelId)
    setBubbledMode({knoxelId: activeBubble.knoxelId, knyteId: knoxels[activeBubble.knoxelId], isBubbled: true});
  if (activeInitialBubble.knoxelId)
    setArrowBubbledMode({knoxelId: activeInitialBubble.knoxelId, initial: true, isBubbled: true});
  if (activeTerminalBubble.knoxelId)
    setArrowBubbledMode({knoxelId: activeTerminalBubble.knoxelId, terminal: true, isBubbled: true});
  // control arrows display
  const arrowsElement = document.getElementById('arrows');
  if (newKnyteId === knoxels[spacemapKnoxelId])
  {
    handleSpacemapChanged(); // TODO: optimise arrows endpoints update
    arrowsElement.style.display = 'block';
  }
  else
  {
    arrowsElement.style.display = 'none';
  }
  handleSteeringChanged();
  // handle custom block enter
  handleCustomBlockEvent({event: 'enter', knoxelId: newKnoxelId, inputCodeMap, inputOptions,
    setKnoxelColor, getKnoxelPosition, setKnoxelPosition, setKnoxelCollapse, getKnyteData, setKnyteData});
}

function collideAABBVsLine(aabb, line)
{
  var box = new intersect.AABB(
    new intersect.Point(aabb.position.x, aabb.position.y), 
    new intersect.Point(0.5*aabb.dimension.w, 0.5*aabb.dimension.h)
  );
  var position = new intersect.Point(line.position1.x, line.position1.y);
  var delta = new intersect.Point(
    line.position2.x - line.position1.x, line.position2.y - line.position1.y
  );
  const hit = box.intersectSegment(position, delta); // returns null or intersect.Hit object
  return hit ? hit.time : 0;
}

function getArrowPointsByRects(desc)
{
  // desc: {arrowSpace, jointKnoxelId, initialKnoxelId, terminalKnoxelId, rectId, initialRectId, terminalRectId, arrowStrokeWidth, ghost}
  const zoom = steeringGear.getZoom();

  function getBoundingClientDimension(element)
  {
    let {width, height} = element.getBoundingClientRect();
    width *= zoom;
    height *= zoom;
    return {w: width, h: height};
  }
  
  const jointPosition = desc.arrowSpace[desc.jointKnoxelId];
  const initialPosition = desc.initialKnoxelId ? desc.arrowSpace[desc.initialKnoxelId] : undefined;
  const terminalPosition = desc.terminalKnoxelId ? desc.arrowSpace[desc.terminalKnoxelId] : undefined;
  let x1;
  let y1;
  let x2 = jointPosition.x;
  let y2 = jointPosition.y;
  let x3;
  let y3;
  let initialCross = false;
  let terminalCross = false;
  const jointElement = document.getElementById(desc.rectId);
  const {w, h} = getBoundingClientDimension(jointElement);
  if (desc.initialKnoxelId === desc.jointKnoxelId)
  {
    x1 = x2 - w/2 - visualTheme.arrow.defaultLength;
    y1 = y2;
  }
  else if (!desc.initialKnoxelId)
  {
    x1 = x2 - visualTheme.arrow.defaultLength/2;
    y1 = y2;
  }
  else if (!initialPosition)
  {
    x1 = x2 - w/2 - visualTheme.arrow.defaultLength;
    y1 = y2;
    initialCross = true;
  }
  else
  {
    x1 = initialPosition.x;
    y1 = initialPosition.y;
    const direction = {
      x: initialPosition.x - jointPosition.x,
      y: initialPosition.y - jointPosition.y
    };
    const directionLengthSquared = direction.x*direction.x + direction.y*direction.y;
    if (directionLengthSquared > 0.01)
    {
      const directionLength = Math.sqrt(directionLengthSquared);
      const directionNormalised = {
        x: direction.x / directionLength,
        y: direction.y / directionLength
      };
      const w = visualTheme.rect.defaultWidth;
      const h = visualTheme.rect.defaultHeight;
      const initialElement = document.getElementById(desc.initialRectId);
      const initialDimension = initialElement ? getBoundingClientDimension(initialElement) : {w, h};
      const rectStrokeOffset = visualTheme.recursive.strokeWidth;
      const arrowIntervalStrokeOffset = desc.arrowStrokeWidth;
      initialDimension.w += rectStrokeOffset + arrowIntervalStrokeOffset;
      initialDimension.h += rectStrokeOffset + arrowIntervalStrokeOffset;
      const initialTime = collideAABBVsLine(
        {position: initialPosition, dimension: initialDimension},
        {position1: jointPosition, position2: initialPosition}
      );
      const initialArrowStrokeOffset = 0.5*desc.arrowStrokeWidth;
      x1 -= ((1 - initialTime) * directionLength + initialArrowStrokeOffset) * directionNormalised.x;
      y1 -= ((1 - initialTime) * directionLength + initialArrowStrokeOffset) * directionNormalised.y;
    }
  }
  if (desc.terminalKnoxelId === desc.jointKnoxelId)
  {
    x3 = x2 + w/2 + visualTheme.arrow.defaultLength;
    y3 = y2;
  }
  else if (!desc.terminalKnoxelId)
  {
    x3 = x2 + visualTheme.arrow.defaultLength/2;
    y3 = y2;
  }
  else if (!terminalPosition)
  {
    x3 = x2 + w/2 + visualTheme.arrow.defaultLength;
    y3 = y2;
    terminalCross = true;
  }
  else
  {
    x3 = terminalPosition.x;
    y3 = terminalPosition.y;
    const direction = {
      x: terminalPosition.x - jointPosition.x,
      y: terminalPosition.y - jointPosition.y
    };
    const directionLengthSquared = direction.x*direction.x + direction.y*direction.y;
    if (directionLengthSquared > 0.01)
    {
      const directionLength = Math.sqrt(directionLengthSquared);
      const directionNormalised = {
        x: direction.x / directionLength,
        y: direction.y / directionLength
      };
      const w = visualTheme.rect.defaultWidth;
      const h = visualTheme.rect.defaultHeight;
      const terminalElement = document.getElementById(desc.terminalRectId);
      const terminalDimension = terminalElement ? getBoundingClientDimension(terminalElement) : {w, h};
      const rectStrokeOffset = visualTheme.recursive.strokeWidth;
      const arrowIntervalStrokeOffset = desc.arrowStrokeWidth;
      terminalDimension.w += rectStrokeOffset + arrowIntervalStrokeOffset;
      terminalDimension.h += rectStrokeOffset + arrowIntervalStrokeOffset;
      const terminalTime = collideAABBVsLine(
        {position: terminalPosition, dimension: terminalDimension},
        {position1: jointPosition, position2: terminalPosition}
      );
      const terminalArrowStrokeOffset = 4.5*desc.arrowStrokeWidth;
      x3 -= ((1 - terminalTime) * directionLength + terminalArrowStrokeOffset) * directionNormalised.x;
      y3 -= ((1 - terminalTime) * directionLength + terminalArrowStrokeOffset) * directionNormalised.y;
    }
  }
  const {x, y} = jointPosition;
  x1 -= x - w/2;
  y1 -= y - h/2;
  x2 -= x - w/2;
  y2 -= y - h/2;
  x3 -= x - w/2;
  y3 -= y - h/2;
  return {x1, y1, x2, y2, x3, y3, initialCross, terminalCross};
}

function getArrowPointsByKnoxels(desc)
{
  // desc: {arrowSpace, jointKnoxelId, initialKnoxelId, terminalKnoxelId, x, y, w, h, arrowStrokeWidth, ghost}
  const ghostsElement = document.getElementById('ghosts');
  const zoom = desc.ghost ? (steeringGear.getZoom()/steeringGear.getZoom(ghostsElement)) : 1.0;
  const jointPosition = desc.ghost
    ? steeringGear.screenToSpacePosition({x: desc.x, y: desc.y})
    : {x: desc.x, y: desc.y};
  const initialPosition = desc.initialKnoxelId ? desc.arrowSpace[desc.initialKnoxelId] : undefined;
  const terminalPosition = desc.terminalKnoxelId ? desc.arrowSpace[desc.terminalKnoxelId] : undefined;
  let x1;
  let y1;
  let x2 = jointPosition.x;
  let y2 = jointPosition.y;
  let x3;
  let y3;
  let initialCross = false;
  let terminalCross = false;
  if (desc.initialKnoxelId === desc.jointKnoxelId)
  {
    x1 = x2 - desc.w/2 - visualTheme.arrow.defaultLength;
    y1 = y2;
  }
  else if (!desc.initialKnoxelId)
  {
    x1 = x2 - visualTheme.arrow.defaultLength/2;
    y1 = y2;
  }
  else if (!initialPosition)
  {
    x1 = x2 - desc.w/2 - visualTheme.arrow.defaultLength;
    y1 = y2;
    if (desc.ghost)
      x1 += activeGhost.offset.x;
    initialCross = true;
  }
  else
  {
    x1 = initialPosition.x;
    y1 = initialPosition.y;
    const direction = {
      x: initialPosition.x - jointPosition.x,
      y: initialPosition.y - jointPosition.y
    };
    const directionLengthSquared = direction.x*direction.x + direction.y*direction.y;
    if (directionLengthSquared > 0.01)
    {
      const directionLength = Math.sqrt(directionLengthSquared);
      const directionNormalised = {
        x: direction.x / directionLength,
        y: direction.y / directionLength
      };
      const w = visualTheme.rect.defaultWidth;
      const h = visualTheme.rect.defaultHeight;
      const initialElement = document.getElementById(desc.initialKnoxelId);
      const initialDimension = initialElement ? knoxelRect.getElementSize(initialElement, false) : {w, h};
      const rectStrokeOffset = visualTheme.rect.strokeWidth;
      const arrowIntervalStrokeOffset = desc.arrowStrokeWidth * zoom;
      initialDimension.w += rectStrokeOffset + arrowIntervalStrokeOffset;
      initialDimension.h += rectStrokeOffset + arrowIntervalStrokeOffset;
      const initialTime = collideAABBVsLine(
        {position: initialPosition, dimension: initialDimension},
        {position1: jointPosition, position2: initialPosition}
      );
      const initialArrowStrokeOffset = 0.5*desc.arrowStrokeWidth * zoom;
      x1 -= ((1 - initialTime) * directionLength + initialArrowStrokeOffset) * directionNormalised.x;
      y1 -= ((1 - initialTime) * directionLength + initialArrowStrokeOffset) * directionNormalised.y;
    }
  }
  if (desc.terminalKnoxelId === desc.jointKnoxelId)
  {
    x3 = x2 + desc.w/2 + visualTheme.arrow.defaultLength;
    y3 = y2;
  }
  else if (!desc.terminalKnoxelId)
  {
    x3 = x2 + visualTheme.arrow.defaultLength/2;
    y3 = y2;
  }
  else if (!terminalPosition)
  {
    x3 = x2 + desc.w/2 + visualTheme.arrow.defaultLength;
    y3 = y2;
    if (desc.ghost)
      x3 += activeGhost.offset.x;
    terminalCross = true;
  }
  else
  {
    x3 = terminalPosition.x;
    y3 = terminalPosition.y;
    const direction = {
      x: terminalPosition.x - jointPosition.x,
      y: terminalPosition.y - jointPosition.y
    };
    const directionLengthSquared = direction.x*direction.x + direction.y*direction.y;
    if (directionLengthSquared > 0.01)
    {
      const directionLength = Math.sqrt(directionLengthSquared);
      const directionNormalised = {
        x: direction.x / directionLength,
        y: direction.y / directionLength
      };
      const w = visualTheme.rect.defaultWidth;
      const h = visualTheme.rect.defaultHeight;
      const terminalElement = document.getElementById(desc.terminalKnoxelId);
      const terminalDimension = terminalElement ? knoxelRect.getElementSize(terminalElement, false) : {w, h};
      const rectStrokeOffset = visualTheme.rect.strokeWidth;
      const arrowIntervalStrokeOffset = desc.arrowStrokeWidth * zoom;
      terminalDimension.w += rectStrokeOffset + arrowIntervalStrokeOffset;
      terminalDimension.h += rectStrokeOffset + arrowIntervalStrokeOffset;
      const terminalTime = collideAABBVsLine(
        {position: terminalPosition, dimension: terminalDimension},
        {position1: jointPosition, position2: terminalPosition}
      );
      const terminalArrowStrokeOffset = 4.5*desc.arrowStrokeWidth * zoom;
      x3 -= ((1 - terminalTime) * directionLength + terminalArrowStrokeOffset) * directionNormalised.x;
      y3 -= ((1 - terminalTime) * directionLength + terminalArrowStrokeOffset) * directionNormalised.y;
    }
  }
  const x = jointPosition.x - desc.w/2;
  const y = jointPosition.y - desc.h/2;
  x1 -= x;
  y1 -= y;
  x2 -= x;
  y2 -= y;
  x3 -= x;
  y3 -= y;
  x1 = (x1 - x2)/zoom + x2;
  y1 = (y1 - y2)/zoom + y2;
  x3 = (x3 - x2)/zoom + x2;
  y3 = (y3 - y2)/zoom + y2;
  return {x1, y1, x2, y2, x3, y3, initialCross, terminalCross};
}

function getArrowPointsByEndpoints(desc)
{
  // desc: {arrowSpace, initialKnoxelId, terminalKnoxelId, x, y, arrowStrokeWidth}
  const initialPosition = desc.arrowSpace[desc.initialKnoxelId];
  const terminalPosition = desc.arrowSpace[desc.terminalKnoxelId];
  let x1 = initialPosition.x;
  let y1 = initialPosition.y;
  let x2 = terminalPosition.x;
  let y2 = terminalPosition.y;
  if (desc.initialKnoxelId === desc.terminalKnoxelId)
  {
    x1 -= visualTheme.arrow.defaultLength;
    x2 += visualTheme.arrow.defaultLength;
  }
  else
  {
    const direction = {
      x: terminalPosition.x - initialPosition.x,
      y: terminalPosition.y - initialPosition.y
    };
    const directionLengthSquared = direction.x*direction.x + direction.y*direction.y;
    if (directionLengthSquared > 0.01)
    {
      const directionLength = Math.sqrt(directionLengthSquared);
      const directionNormalised = {
        x: direction.x / directionLength,
        y: direction.y / directionLength
      };
      const w = visualTheme.rect.defaultWidth;
      const h = visualTheme.rect.defaultHeight;
      const initialElement = document.getElementById(desc.initialKnoxelId);
      const initialDimension = initialElement ? knoxelRect.getElementSize(initialElement, false) : {w, h};
      const initialTime = collideAABBVsLine(
        {position: initialPosition, dimension: initialDimension},
        {position1: terminalPosition, position2: initialPosition}
      );
      const terminalElement = document.getElementById(desc.terminalKnoxelId);
      const terminalDimension = terminalElement ? knoxelRect.getElementSize(terminalElement, false) : {w, h};
      const terminalTime = collideAABBVsLine(
        {position: terminalPosition, dimension: terminalDimension},
        {position1: initialPosition, position2: terminalPosition}
      );
      const rectStrokeOffset = 0.5*visualTheme.rect.strokeWidth;
      const initialArrowStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const terminalArrowStrokeOffset = 4.5*desc.arrowStrokeWidth;
      const arrowIntervalStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const initialStrokeOffset = rectStrokeOffset + initialArrowStrokeOffset + arrowIntervalStrokeOffset;
      x1 += ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.x;
      y1 += ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.y;
      const terminalStrokeOffset = rectStrokeOffset + terminalArrowStrokeOffset + arrowIntervalStrokeOffset;
      x2 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.x;
      y2 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.y;
    }
  }
  x1 -= desc.x;
  y1 -= desc.y;
  x2 -= desc.x;
  y2 -= desc.y;
  return {x1, y1, x2, y2};
}

function addOriginsArrow(desc)
{
  // desc: {id, initialKnoxelId, terminalKnoxelId}
  const spaceRootKnyteId = knoxels[spacemapKnoxelId];
  const arrowSpace = informationMap[spaceRootKnyteId].space;
  const {x1, y1, x2, y2} = getArrowPointsByEndpoints(
    {arrowSpace, initialKnoxelId: desc.initialKnoxelId, terminalKnoxelId: desc.terminalKnoxelId,
       x: 0, y: 0, arrowStrokeWidth: visualTheme.arrow.strokeWidth}
  );
  const arrow = document.createElementNS(svgNameSpace, 'line');
  arrow.id = desc.id;
  arrow.setAttribute('x1', x1);
  arrow.setAttribute('y1', y1);
  arrow.setAttribute('x2', x2);
  arrow.setAttribute('y2', y2);
  arrow.setAttribute('stroke', visualTheme.knoxel.defaultColor);
  arrow.setAttribute('stroke-width', visualTheme.arrow.strokeWidth);
  arrow.setAttribute('marker-end', 'url(#spaceHead)');
  arrow.style.pointerEvents = 'none';
  document.getElementById('arrows').appendChild(arrow);
  arrows[desc.id] = {initialKnoxelId: desc.initialKnoxelId, terminalKnoxelId: desc.terminalKnoxelId};
}

function cleanupArrows()
{
  const spaceArrows = document.getElementById('arrows');
  while (spaceArrows.firstElementChild)
  {
    delete arrows[spaceArrows.firstElementChild.id];
    spaceArrows.firstElementChild.remove();
  }
}

function addKnoxelRect(desc)
{
  // desc: {knyteId, hostKnoxelId, position, collapse, color}
  const position = activeGhost.knoxelId
    ? {x: desc.position.x + activeGhost.offset.x, y: desc.position.y + activeGhost.offset.y}
    : desc.position;
  const hostKnyteId = knoxels[desc.hostKnoxelId];
  const knoxelId = knit.new();
  addKnoxel({hostKnyteId, knyteId: desc.knyteId, knoxelId, position, collapse: desc.collapse, color: desc.color});
  knoxelRect.add({knoxelId, position});
  knoxelRect.updateArrowShape(knoxelId, position);
  return knoxelId;
}

function parseTransform(s)
{
  const pair = s.split('(')[1].split(' ');
  const x = parseFloat(pair[0]);
  const y = parseFloat(pair[1]);
  return {x, y};
}

function onClickRect(e)
{
  if (!inputOptions.handleMouseClick)
    return;
  if (activeFrame.element)
    return;
  const targetKnoxelElement = knoxelRect.getRootByTarget(e.target);
  if (!e.shiftKey && !e.altKey && !e.cmdKey())
  {
    if (targetKnoxelElement && targetKnoxelElement.id !== spaceRootElement.dataset.knoxelId)
    {
      spaceBackStack.push(spaceRootElement.dataset.knoxelId);
      steeringBackStack.push(steeringGear.getCTM());
      spaceForwardStack.length = 0;
      steeringForwardStack.length = 0;
      const spacemap = knoxels[targetKnoxelElement.id] === knoxels[spacemapKnoxelId];
      const selfcontained = knoxels[targetKnoxelElement.id] === knoxels[spaceRootElement.dataset.knoxelId];
      if (spacemap)
      {
        setSpaceRootKnoxel({knoxelId: targetKnoxelElement.id});
        steeringGear.setCTM(spaceRootElement.createSVGMatrix());
      }
      else if (!selfcontained)
      {
        const panOffset = steeringGear.getPan();
        const zoom = steeringGear.getZoom();
        const knoxelLeftTop = parseTransform(targetKnoxelElement.getAttribute('transform'));
        const knoxelSize = knoxelRect.getElementSize(targetKnoxelElement, false);
        const {leftTop, w, h} = knoxelRect.getKnoxelDimensions(targetKnoxelElement.id);
        setSpaceRootKnoxel({knoxelId: targetKnoxelElement.id}); // +++1
        const x = panOffset.x + (knoxelLeftTop.x + knoxelSize.w/2 - leftTop.x - w/2)/zoom;
        const y = panOffset.y + (knoxelLeftTop.y + knoxelSize.h/2 - leftTop.y - h/2)/zoom;
        steeringGear.setPan({x, y});
      }
      else
        setSpaceRootKnoxel({knoxelId: targetKnoxelElement.id});
      refreshActiveRect({screenPosition: mouseMovePosition});
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
      });
    }
    e.stopPropagation(); // to prevent onClickSpaceRoot call
  }
}

function divideKnoxel(desc)
{
  // desc: {dividedKnoxelId, hostKnoxelId, position}
  const knyteId = knoxels[desc.dividedKnoxelId];
  const collapse = knoxelViews[desc.dividedKnoxelId].collapse;
  addKnoxelRect({knyteId, hostKnoxelId: desc.hostKnoxelId, position: desc.position, collapse});
}

function cleanupKnoxelVectorsByKnyteVector(desc)
{
  // desc: {jointKnyteId, initialKnyteId, terminalKnyteId}
  for (let knoxelId in knoxelVectors)
  {
    const knyteId = knoxels[knoxelId];
    if (knyteId === desc.jointKnyteId)
    {
      const endpoints = knoxelVectors[knoxelId];
      const initialKnyteId = knoxels[endpoints.initialKnoxelId];
      const terminalKnyteId = knoxels[endpoints.terminalKnoxelId];
      if (initialKnyteId !== desc.initialKnyteId)
        delete endpoints.initialKnoxelId;
      if (terminalKnyteId !== desc.terminalKnyteId)
        delete endpoints.terminalKnoxelId;
    }
  }  
}

function assignKnyteVectorInitial(desc)
{
  // desc: {jointKnyteId, initialKnyteId}
  const priorInitialKnyteId = knyteVectors[desc.jointKnyteId].initialKnyteId;
  knyteVectors[desc.jointKnyteId].initialKnyteId = desc.initialKnyteId;
  const {initialKnyteId, terminalKnyteId} = knyteVectors[desc.jointKnyteId];
  updateKnyteConnects(priorInitialKnyteId, 'initial', 'remove', desc.jointKnyteId);
  updateKnyteConnects(initialKnyteId, 'initial', 'add', desc.jointKnyteId);
  cleanupKnoxelVectorsByKnyteVector({jointKnyteId: desc.jointKnyteId, initialKnyteId, terminalKnyteId});
}

function assignKnyteVectorTerminal(desc)
{
  // desc: {jointKnyteId, terminalKnyteId}
  const priorTerminalKnyteId = knyteVectors[desc.jointKnyteId].terminalKnyteId;
  knyteVectors[desc.jointKnyteId].terminalKnyteId = desc.terminalKnyteId;
  const {initialKnyteId, terminalKnyteId} = knyteVectors[desc.jointKnyteId];
  updateKnyteConnects(priorTerminalKnyteId, 'terminal', 'remove', desc.jointKnyteId);
  updateKnyteConnects(terminalKnyteId, 'terminal', 'add', desc.jointKnyteId);
  cleanupKnoxelVectorsByKnyteVector({jointKnyteId: desc.jointKnyteId, initialKnyteId, terminalKnyteId});
}

function assignKnoxelVectorInitial(desc)
{
  // desc: {jointKnoxelId, initialKnoxelId}
  if (desc.initialKnoxelId)
  {
    const jointKnyteId = knoxels[desc.jointKnoxelId];
    const initialKnyteId = knoxels[desc.initialKnoxelId];
    if (knyteVectors[jointKnyteId].initialKnyteId !== initialKnyteId)
    {
      console.error('knoxels knyteVectors must match: ' + desc.jointKnoxelId + ', ' + desc.initialKnoxelId);
      return;
    }
  }
  if (!(desc.jointKnoxelId in knoxelVectors))
    knoxelVectors[desc.jointKnoxelId] = {};
  if (desc.initialKnoxelId)
    knoxelVectors[desc.jointKnoxelId].initialKnoxelId = desc.initialKnoxelId;
  else
    delete knoxelVectors[desc.jointKnoxelId].initialKnoxelId;
}

function assignKnoxelVectorTerminal(desc)
{
  // desc: {jointKnoxelId, terminalKnoxelId}
  if (desc.terminalKnoxelId)
  {
    const jointKnyteId = knoxels[desc.jointKnoxelId];
    const terminalKnyteId = knoxels[desc.terminalKnoxelId];
    if (knyteVectors[jointKnyteId].terminalKnyteId !== terminalKnyteId)
    {
      console.error('knoxels knyteVectors must match: ' + desc.jointKnoxelId + ', ' + desc.terminalKnoxelId);
      return;
    }
  }
  if (!(desc.jointKnoxelId in knoxelVectors))
    knoxelVectors[desc.jointKnoxelId] = {};
  if (desc.terminalKnoxelId)
    knoxelVectors[desc.jointKnoxelId].terminalKnoxelId = desc.terminalKnoxelId;
  else
    delete knoxelVectors[desc.jointKnoxelId].terminalKnoxelId;
}

function replaceKnoxelInVector(desc)
{
  // desc: {removeKnoxelId, stayKnoxelId}
  if (knoxels[desc.removeKnoxelId] !== knoxels[desc.stayKnoxelId])
  {
    console.error('knoxels knytes must match: ' + desc.removeKnoxelId + ', ' + desc.stayKnoxelId);
    return;
  }
  for (let knoxelId in knoxelVectors)
  {
    const endpoints = knoxelVectors[knoxelId];
    if (endpoints.initialKnoxelId === desc.removeKnoxelId)
      endpoints.initialKnoxelId = desc.stayKnoxelId;
    if (endpoints.terminalKnoxelId === desc.removeKnoxelId)
      endpoints.terminalKnoxelId = desc.stayKnoxelId;
  }
}

function joinKnoxels(desc)
{
  // desc: {removeKnoxelId, stayKnoxelId}
  
  // reassign all vectors from removeKnoxel to stayKnoxel
  replaceKnoxelInVector(desc);
  // remove knoxel and its info knoxel vector map
  replaceKnoxelInStacks(desc);
  removeKnoxel({knoxelId: desc.removeKnoxelId});
  delete knoxelVectors[desc.removeKnoxelId];
  // handle spacemap case
  if (desc.removeKnoxelId === spacemapKnoxelId)
    spacemapKnoxelId = desc.stayKnoxelId;
}

function getHostKnyteIdByKnoxelId(knoxelId)
{
  // TODO: optimise it - replace by simple knoxelId -> hostKnyteId map
  for (let knyteId in informationMap)
    if (knoxelId in informationMap[knyteId].space)
      return knyteId;
  return null;
}

function removeKnoxel(desc)
{
  // desc: {knoxelId}
  
  // cleanup space
  let hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
  const space = informationMap[hostKnyteId].space;
  delete space[desc.knoxelId];
  // cleanup knoxel
  delete knoxelViews[desc.knoxelId];
  delete knoxels[desc.knoxelId];
  // cleanup arrows
  const arrowsToRemove = {};
  for (let arrowId in arrows)
  {
    const arrow = arrows[arrowId];
    if (arrow.initialKnoxelId === desc.knoxelId || arrow.terminalKnoxelId === desc.knoxelId)
      arrowsToRemove[arrowId] = true;
  }
  for (let arrowId in arrowsToRemove)
    delete arrows[arrowId];
}

function replaceKnoxelInStacks(desc)
{
  // desc: {removeKnoxelId, stayKnoxelId}
  for (let i = 0; i < spaceBackStack.length; ++i)
    if (spaceBackStack[i] === desc.removeKnoxelId)
      spaceBackStack[i] = desc.stayKnoxelId;
  for (let i = 0; i < spaceForwardStack.length; ++i)
    if (spaceForwardStack[i] === desc.removeKnoxelId)
      spaceForwardStack[i] = desc.stayKnoxelId;
}

function rectContainsRect(rect1, rect2)
{
  return rect1.left < rect2.left && rect1.top < rect2.top &&
    rect1.right > rect2.right && rect1.bottom > rect2.bottom;
}

function rectExpandByRect(rect1, rect2)
{
  if (rect1.left > rect2.left)
    rect1.left = rect2.left;
  if (rect1.top > rect2.top)
    rect1.top = rect2.top;
  if (rect1.right < rect2.right)
    rect1.right = rect2.right;
  if (rect1.bottom < rect2.bottom)
    rect1.bottom = rect2.bottom;
}

function onClickSpaceRoot(e)
{
  if (!inputOptions.handleMouseClick)
    return;
  const mousePosition = {x: e.clientX, y: e.clientY};
  if (!(e.shiftKey && e.altKey) && e.cmdKey())
  {
    const targetKnyteId = e.shiftKey ? prompt('Specify knyte id for new block:') : knit.new();
    const uuidv4pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!targetKnyteId)
      return;
    if (!uuidv4pattern.test(targetKnyteId))
    {
      alert('Invalid knyte id specified. Must be uuid v4. Block creation cancelled.');
      return;
    }
    if (targetKnyteId.toLowerCase() in knyteVectors)
    {
      alert('Duplicated knyte id specified. Block creation cancelled.');
      return;
    }
    const knyteId = targetKnyteId;
    const color = visualTheme.rect.fillColor;
    addKnyte({knyteId, color});
    const position = steeringGear.screenToSpacePosition(mousePosition);
    addKnoxelRect({knyteId, hostKnoxelId: spaceRootElement.dataset.knoxelId, position});
    if (e.altKey)
    {
      const recordtype = 'interactive';
      const data = codeTemplates.runBlock.ready(knyteId, 'init');
      setKnyteRecordData(knyteId, recordtype, data);
      setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
    }
    else
      knoxelSpaceRoot.update();
    handleSpacemapChanged();
  }
}

function onClickSpaceMap(e)
{
  if (spaceRootElement.dataset.knoxelId === spacemapKnoxelId)
    return;
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  steeringBackStack.push(steeringGear.getCTM());
  spaceForwardStack.length = 0;
  steeringForwardStack.length = 0;
  const selfcontained = knoxels[spacemapKnoxelId] === knoxels[spaceRootElement.dataset.knoxelId];
  if (!selfcontained)
  {
    setSpaceRootKnoxel({knoxelId: spacemapKnoxelId}); // +++3
    steeringGear.setCTM(spaceRootElement.createSVGMatrix());
  }
  else
    setSpaceRootKnoxel({knoxelId: spacemapKnoxelId});
  refreshActiveRect({screenPosition: mouseMovePosition});
  setNavigationControlState({
    backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
  });
}

function onClickSpaceBack()
{
  spaceForwardStack.push(spaceRootElement.dataset.knoxelId);
  steeringForwardStack.push(steeringGear.getCTM());
  const backKnoxelId = spaceBackStack.pop();
  const backKnoxelSteering = steeringBackStack.pop();
  if (backKnoxelId)
  {
    const fromSpacemap = knoxels[spacemapKnoxelId] === knoxels[spaceRootElement.dataset.knoxelId];
    const toSpacemap = knoxels[spacemapKnoxelId] === knoxels[backKnoxelId];
    const selfcontained = knoxels[backKnoxelId] === knoxels[spaceRootElement.dataset.knoxelId];
    if (fromSpacemap)
    {
      setSpaceRootKnoxel({knoxelId: backKnoxelId});
      steeringGear.setCTM(backKnoxelSteering);
    }
    else if (toSpacemap)
    {
      setSpaceRootKnoxel({knoxelId: backKnoxelId});
      steeringGear.setCTM(spaceRootElement.createSVGMatrix());
    }
    else if (!selfcontained)
    {
      const panOffset = steeringGear.getPan();
      const zoom = steeringGear.getZoom();
      const priorKnoxelId = spaceRootElement.dataset.knoxelId;
      setSpaceRootKnoxel({knoxelId: backKnoxelId}); // +++2
      const priorKnoxelElement = document.getElementById(priorKnoxelId);
      if (priorKnoxelElement)
      {
        const knoxelLeftTop = parseTransform(priorKnoxelElement.getAttribute('transform'));
        const knoxelSize = knoxelRect.getElementSize(priorKnoxelElement, false);
        const {leftTop, w, h} = knoxelRect.getKnoxelDimensions(priorKnoxelId);
        const x = panOffset.x - (knoxelLeftTop.x + knoxelSize.w/2 - leftTop.x - w/2)/zoom;
        const y = panOffset.y - (knoxelLeftTop.y + knoxelSize.h/2 - leftTop.y - h/2)/zoom;
        steeringGear.setPan({x, y});
      }
    }
    else
      setSpaceRootKnoxel({knoxelId: backKnoxelId});
    refreshActiveRect({screenPosition: mouseMovePosition});
    setNavigationControlState({
      backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
      forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
    });
  }
}

function onClickSpaceForward()
{
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  steeringBackStack.push(steeringGear.getCTM());
  const forwardKnoxelId = spaceForwardStack.pop();
  const forwardKnoxelSteering = steeringForwardStack.pop();
  if (forwardKnoxelId)
  {
    const fromSpacemap = knoxels[spacemapKnoxelId] === knoxels[spaceRootElement.dataset.knoxelId];
    const toSpacemap = knoxels[spacemapKnoxelId] === knoxels[forwardKnoxelId];
    const selfcontained = knoxels[forwardKnoxelId] === knoxels[spaceRootElement.dataset.knoxelId];
    const forwardKnoxelElement = document.getElementById(forwardKnoxelId);
    if (fromSpacemap)
    {
      setSpaceRootKnoxel({knoxelId: forwardKnoxelId});
      steeringGear.setCTM(forwardKnoxelSteering);
    }
    else if (toSpacemap)
    {
      setSpaceRootKnoxel({knoxelId: forwardKnoxelId});
      steeringGear.setCTM(spaceRootElement.createSVGMatrix());
    }
    else if (!selfcontained && forwardKnoxelElement)
    {
      const panOffset = steeringGear.getPan();
      const zoom = steeringGear.getZoom();
      const knoxelLeftTop = parseTransform(forwardKnoxelElement.getAttribute('transform'));
      const knoxelSize = knoxelRect.getElementSize(forwardKnoxelElement, false);
      const {leftTop, w, h} = knoxelRect.getKnoxelDimensions(forwardKnoxelId);
      setSpaceRootKnoxel({knoxelId: forwardKnoxelId}); // +++2
      const x = panOffset.x + (knoxelLeftTop.x + knoxelSize.w/2 - leftTop.x - w/2)/zoom;
      const y = panOffset.y + (knoxelLeftTop.y + knoxelSize.h/2 - leftTop.y - h/2)/zoom;
      steeringGear.setPan({x, y});
    }
    else
      setSpaceRootKnoxel({knoxelId: forwardKnoxelId});
    refreshActiveRect({screenPosition: mouseMovePosition});
    setNavigationControlState({
      backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
      forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
    });
  }
}

function onResizeWindow(e)
{
  spaceRootElement.setAttribute('width', window.innerWidth);
  spaceRootElement.setAttribute('height', window.innerHeight);
}
function setNavigationControlState(desc)
{
  // desc: {backKnoxelId, forwardKnoxelId}
  const backKnyteId = knoxels[desc.backKnoxelId];
  if (!backKnyteId)
    spaceBackElement.style.display = 'none';
  else
  {
    const color = informationMap[backKnyteId].color;
    spaceBackElement.style.display = 'block';
    const backArrowShape = document.getElementById('backArrowShape');
    backArrowShape.setAttribute('stroke', visualTheme.navigation.strokeColor);
    backArrowShape.setAttribute('fill', color);
  }
  const forwardKnyteId = knoxels[desc.forwardKnoxelId];
  if (!forwardKnyteId)
    spaceForwardElement.style.display = 'none';
  else
  {
    const color = informationMap[forwardKnyteId].color;
    spaceForwardElement.style.display = 'block';
    const forwardArrowShape = document.getElementById('forwardArrowShape');
    forwardArrowShape.setAttribute('stroke', visualTheme.navigation.strokeColor);
    forwardArrowShape.setAttribute('fill', color);
  }
  if (spaceRootElement.dataset.knoxelId !== spacemapKnoxelId)
  {
    const mapShape = document.getElementById('mapShape');
    mapShape.setAttribute('stroke', visualTheme.navigation.strokeColor);
    mapShape.setAttribute('fill', visualTheme.navigation.fillColor);
    spaceMapElement.style.display = 'block';
  }
  else
    spaceMapElement.style.display = 'none';
}

function createActiveRect(desc)
{
  // desc: {knoxelId, position, ghost, bubble}
  const id = knoxelRect.add(desc);
  return document.getElementById(id);
}

function refreshActiveRect(desc)
{
  // desc: {screenPosition}
  if (activeGhost.knoxelId)
  {
    const position = activeGhost.offset;
    activeGhost.element.remove();
    activeGhost.element = createActiveRect({knoxelId: activeGhost.knoxelId, position, ghost: true});
    const {x, y} = mouseMovePosition;
    knoxelRect.moveElement({element: activeGhost.element, x, y});
  }
  if (activeBubble.knoxelId)
  {
    const position = activeBubble.offset;
    activeBubble.element.remove();
    activeBubble.element = createActiveRect({knoxelId: activeBubble.knoxelId, position, bubble: true});
    const {x, y} = mouseMovePosition;
    knoxelRect.moveElement({element: activeBubble.element, x, y});
  }
  const position = desc.screenPosition;
  if (activeInitialGhost.knoxelId)
  {
    activeInitialGhost.element.remove();
    activeInitialGhost.element = createActiveArrow(
      {knoxelId: activeInitialGhost.knoxelId, position, initial: true, ghost: true});
  }
  if (activeTerminalGhost.knoxelId)
  {
    activeTerminalGhost.element.remove();
    activeTerminalGhost.element = createActiveArrow(
      {knoxelId: activeTerminalGhost.knoxelId, position, terminal: true, ghost: true});
  }
  if (activeInitialBubble.knoxelId)
  {
    activeInitialBubble.element.remove();
    activeInitialBubble.element = createActiveArrow(
      {knoxelId: activeInitialBubble.knoxelId, position, initial: true, bubble: true});
  }
  if (activeTerminalBubble.knoxelId)
  {
    activeTerminalBubble.element.remove();
    activeTerminalBubble.element = createActiveArrow(
      {knoxelId: activeTerminalBubble.knoxelId, position, terminal: true, bubble: true});
  }
}

function createActiveFrame(desc)
{
  // desc: {position}
  const strokeWidth = visualTheme.rect.strokeWidth;
  const color = visualTheme.frame.color;
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.setAttribute('x', desc.position.x);
  rect.setAttribute('y', desc.position.y);
  rect.setAttribute('width', strokeWidth);
  rect.setAttribute('height', strokeWidth);
  rect.setAttribute('fill', color + '40');
  rect.setAttribute('stroke', color);
  rect.setAttribute('stroke-width', strokeWidth);
  rect.style.pointerEvents = 'none';
  document.getElementById('frames').appendChild(rect);
  return rect;
}

const activeGhost = {
  knoxelId: null,
  spawnSpaceRootKnoxelId: null,
  hostKnyteId: null,
  offset: {x: 0, y: 0},
  element: null,
};

function spawnGhostRect(desc)
{
  // desc: {knoxelId, spawnSpaceRootKnoxelId, position, selfcontained}
  activeGhost.knoxelId = desc.knoxelId;
  activeGhost.spawnSpaceRootKnoxelId = desc.spawnSpaceRootKnoxelId;
  activeGhost.hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
  const spawnSpaceRootKnoxelSpace = informationMap[knoxels[desc.spawnSpaceRootKnoxelId]].space;
  if (desc.selfcontained)
    activeGhost.offset = {x: 0, y: 0};
  else
  {
    const knoxelPosition = spawnSpaceRootKnoxelSpace[desc.knoxelId];
    const ox = knoxelPosition.x - desc.position.x;
    const oy = knoxelPosition.y - desc.position.y;
    activeGhost.offset = {x: ox, y: oy};
  }
  activeGhost.element = createActiveRect({knoxelId: desc.knoxelId, position: activeGhost.offset, ghost: true});
  const {x, y} = mouseMovePosition;
  knoxelRect.moveElement({element: activeGhost.element, x, y});
  if (!desc.selfcontained)
    knoxelRect.updateArrowShape(activeGhost.knoxelId, {x, y}, true);
  if (desc.knoxelId in spawnSpaceRootKnoxelSpace)
    setGhostedMode({knoxelId: desc.knoxelId, isGhosted: true});
}

function terminateGhostRect()
{
  activeGhost.element.remove();
  const knyteId = knoxels[spaceRootElement.dataset.knoxelId];
  if (activeGhost.knoxelId in informationMap[knyteId].space)
    setGhostedMode({knoxelId: activeGhost.knoxelId, isGhosted: false});
  activeGhost.knoxelId = null;
  activeGhost.spawnSpaceRootKnoxelId = null;
  activeGhost.hostKnyteId = null;
  activeGhost.offset = {x: 0, y: 0};
  activeGhost.element = null;
}

const activeBubble = {
  knoxelId: null,
  offset: {x: 0, y: 0},
  element: null,
};

function spawnBubbleRect(desc)
{
  // desc: {knoxelId, position, selfcontained}
  activeBubble.knoxelId = desc.knoxelId;
  const knyteId = knoxels[desc.knoxelId];
  if (desc.selfcontained)
    activeBubble.offset = {x: 0, y: 0};
  else
  {
    const hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
    const hostKnoxelSpace = informationMap[hostKnyteId].space;
    const knoxelPosition = hostKnoxelSpace[desc.knoxelId];
    const ox = knoxelPosition.x - desc.position.x;
    const oy = knoxelPosition.y - desc.position.y;
    activeBubble.offset = {x: ox, y: oy};
  }
  activeBubble.element = createActiveRect({knoxelId: desc.knoxelId, position: activeBubble.offset, bubble: true});
  const {x, y} = mouseMovePosition;
  knoxelRect.moveElement({element: activeBubble.element, x, y});
  setBubbledMode({knoxelId: activeBubble.knoxelId, knyteId, isBubbled: true});
}

function terminateBubbleRect()
{
  activeBubble.element.remove();
  setBubbledMode({knoxelId: activeBubble.knoxelId, knyteId: knoxels[activeBubble.knoxelId], isBubbled: false});
  activeBubble.knoxelId = null;
  activeBubble.offset = {x: 0, y: 0};
  activeBubble.element = null;
}

const activeFrame = {
  origin: {x: 0, y: 0},
  element: null,
};

function spawnFrameRect(desc)
{
  // desc: {position}
  activeFrame.element = createActiveFrame(desc);
  activeFrame.origin = desc.position;
}

function terminateFrameRect()
{
  activeFrame.element.remove();
  activeFrame.origin = {x: 0, y: 0};
  activeFrame.element = null;
}

function createActiveArrow(desc)
{
  // desc: {knoxelId, position, initial, terminal, ghost, bubble}
  const arrow = document.createElementNS(svgNameSpace, 'line');
  const spaceRootKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
  const spacePosition = informationMap[spaceRootKnyteId].space[desc.knoxelId];
  const strokeColor = knoxelViews[desc.knoxelId].color;
  let cross = false;
  let originPosition;
  if (!spacePosition)
  {
    originPosition = {x: desc.position.x + visualTheme.arrow.defaultLength, y: desc.position.y};
    cross = true;
  }
  else
  {
    originPosition = spacePosition;
    originPosition = steeringGear.spaceToScreenPosition(originPosition);
  }
  arrow.style.pointerEvents = 'none';
  arrow.setAttribute('x1', originPosition.x);
  arrow.setAttribute('y1', originPosition.y);
  arrow.setAttribute('x2', desc.position.x);
  arrow.setAttribute('y2', desc.position.y);
  arrow.setAttribute('fill', 'none');
  arrow.setAttribute('stroke', strokeColor);
  arrow.setAttribute('stroke-width', visualTheme.arrow.strokeWidth);
  if (desc.bubble)
  {
    arrow.setAttribute('stroke-dasharray', '0 8');
    arrow.setAttribute('stroke-linecap', 'square');
  }
  if (desc.initial)
    arrow.setAttribute(cross ? 'marker-start' : 'marker-end', cross ? 'url(#crossTail)' : 'url(#arrowTail)');
  else if (desc.terminal)
    arrow.setAttribute('marker-end', cross ? 'url(#crossHead)' : 'url(#arrowHead)');
  document.getElementById('arrowGhosts').appendChild(arrow);
  return arrow;
}

const activeInitialGhost = {
  knoxelId: null,
  spawnSpaceRootKnoxelId: null,
  hostKnyteId: null,
  element: null,
};

function spawnInitialGhostArrow(desc)
{
  // desc: {knoxelId, spawnSpaceRootKnoxelId, position}
  activeInitialGhost.knoxelId = desc.knoxelId;
  activeInitialGhost.spawnSpaceRootKnoxelId = desc.spawnSpaceRootKnoxelId;
  activeInitialGhost.hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
  activeInitialGhost.element = createActiveArrow({knoxelId: desc.knoxelId, position: desc.position, initial: true, ghost: true});
  setArrowGhostedMode({knoxelId: activeInitialGhost.knoxelId, isGhosted: true});
}

function terminateInitialGhostArrow()
{
  const knyteId = knoxels[spaceRootElement.dataset.knoxelId];
  if (activeInitialGhost.knoxelId in informationMap[knyteId].space)
    setArrowGhostedMode({knoxelId: activeInitialGhost.knoxelId, isGhosted: false});
  activeInitialGhost.element.remove();
  activeInitialGhost.knoxelId = null;
  activeInitialGhost.spawnSpaceRootKnoxelId = null;
  activeInitialGhost.hostKnyteId = null;
  activeInitialGhost.element = null;
}

const activeTerminalGhost = {
  knoxelId: null,
  spawnSpaceRootKnoxelId: null,
  hostKnyteId: null,
  element: null,
};

function spawnTerminalGhostArrow(desc)
{
  // desc: {knoxelId, spawnSpaceRootKnoxelId, position}
  activeTerminalGhost.knoxelId = desc.knoxelId;
  activeTerminalGhost.spawnSpaceRootKnoxelId = desc.spawnSpaceRootKnoxelId;
  activeTerminalGhost.hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
  activeTerminalGhost.element = createActiveArrow({knoxelId: desc.knoxelId, position: desc.position, terminal: true, ghost: true});
  setArrowGhostedMode({knoxelId: activeTerminalGhost.knoxelId, isGhosted: true});
}

function terminateTerminalGhostArrow()
{
  const knyteId = knoxels[spaceRootElement.dataset.knoxelId];
  if (activeTerminalGhost.knoxelId in informationMap[knyteId].space)
    setArrowGhostedMode({knoxelId: activeTerminalGhost.knoxelId, isGhosted: false});
  activeTerminalGhost.element.remove();
  activeTerminalGhost.knoxelId = null;
  activeTerminalGhost.spawnSpaceRootKnoxelId = null;
  activeTerminalGhost.hostKnyteId = null;
  activeTerminalGhost.element = null;
}

const activeInitialBubble = {
  knoxelId: null,
  spawnSpaceRootKnoxelId: null,
  hostKnyteId: null,
  element: null,
};

function spawnInitialBubbleArrow(desc)
{
  // desc: {knoxelId, spawnSpaceRootKnoxelId, position}
  activeInitialBubble.knoxelId = desc.knoxelId;
  activeInitialBubble.spawnSpaceRootKnoxelId = desc.spawnSpaceRootKnoxelId;
  activeInitialBubble.hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
  activeInitialBubble.element = createActiveArrow({knoxelId: desc.knoxelId, position: desc.position, initial: true, bubble: true});
  setArrowBubbledMode({knoxelId: activeInitialBubble.knoxelId, initial: true, isBubbled: true});
}

function terminateInitialBubbleArrow()
{
  const knyteId = knoxels[spaceRootElement.dataset.knoxelId];
  activeInitialBubble.element.remove();
  setArrowBubbledMode({knoxelId: activeInitialBubble.knoxelId, initial: true, isBubbled: false});
  activeInitialBubble.knoxelId = null;
  activeInitialBubble.spawnSpaceRootKnoxelId = null;
  activeInitialBubble.hostKnyteId = null;
  activeInitialBubble.element = null;
}

const activeTerminalBubble = {
  knoxelId: null,
  spawnSpaceRootKnoxelId: null,
  hostKnyteId: null,
  element: null,
};

function spawnTerminalBubbleArrow(desc)
{
  // desc: {knoxelId, spawnSpaceRootKnoxelId, position}
  activeTerminalBubble.knoxelId = desc.knoxelId;
  activeTerminalBubble.spawnSpaceRootKnoxelId = desc.spawnSpaceRootKnoxelId;
  activeTerminalBubble.hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
  activeTerminalBubble.element = createActiveArrow({knoxelId: desc.knoxelId, position: desc.position, terminal: true, bubble: true});
  setArrowBubbledMode({knoxelId: activeTerminalBubble.knoxelId, terminal: true, isBubbled: true});
}

function terminateTerminalBubbleArrow()
{
  const knyteId = knoxels[spaceRootElement.dataset.knoxelId];
  activeTerminalBubble.element.remove();
  setArrowBubbledMode({knoxelId: activeTerminalBubble.knoxelId, terminal: true, isBubbled: false});
  activeTerminalBubble.knoxelId = null;
  activeTerminalBubble.spawnSpaceRootKnoxelId = null;
  activeTerminalBubble.hostKnyteId = null;
  activeTerminalBubble.element = null;
}

let mouseMovePosition = {x: 0, y: 0};
let mouseMovePagePosition = {x: 0, y: 0};

function updateFrameRect(desc)
{
  // desc: {position}
  const position1 = activeFrame.origin;
  const position2 = desc.position;
  const x = Math.min(position1.x, position2.x);
  const w = Math.abs(position1.x - position2.x);
  const y = Math.min(position1.y, position2.y);
  const h = Math.abs(position1.y - position2.y);
  activeFrame.element.setAttribute('x', x);
  activeFrame.element.setAttribute('y', y);
  activeFrame.element.setAttribute('width', w);
  activeFrame.element.setAttribute('height', h);
}

function onMouseMoveSpaceRoot(e)
{
  mouseMovePosition = {x: e.clientX, y: e.clientY};
  mouseMovePagePosition = {x: e.pageX, y: e.pageY};

  if (e.buttons === 4) // mouse input systems support
  {
    if (!document.getElementById('colorpicker').open && !document.getElementById('recordeditor').open)
    {
      if (!e.shiftKey && !e.altKey && !e.cmdKey())
      {
        const panDelta = {x: e.movementX, y: e.movementY};
        steeringGear.pan(panDelta, true);
      }
    }
  }

  const {x, y} = mouseMovePosition;
  if (activeGhost.knoxelId)
  {
    knoxelRect.moveElement({element: activeGhost.element, x, y});
    knoxelRect.updateArrowShape(activeGhost.knoxelId, {x, y}, true);
  }
  if (activeBubble.knoxelId)
  {
    knoxelRect.moveElement({element: activeBubble.element, x, y});
  }
  if (activeFrame.element)
  {
    const position = steeringGear.screenToSpacePosition(mouseMovePosition);
    updateFrameRect({position});
  }
  if (activeInitialGhost.knoxelId)
    var {knoxelId, element} = activeInitialGhost;
  if (activeTerminalGhost.knoxelId)
    var {knoxelId, element} = activeTerminalGhost;
  if (activeInitialBubble.knoxelId)
    var {knoxelId, element} = activeInitialBubble;
  if (activeTerminalBubble.knoxelId)
    var {knoxelId, element} = activeTerminalBubble;
  if (knoxelId)
    knoxelArrow.moveElement({knoxelId, element, x, y});
}

function dropGhostRect(desc)
{
  // desc: {droppedKnoxelId, droppedHostKnyteId, position}
  const landingKnoxelId = spaceRootElement.dataset.knoxelId;  
  const landingKnyteId = knoxels[landingKnoxelId];
  if (
    desc.droppedKnoxelId === landingKnoxelId &&
    !(desc.droppedKnoxelId in informationMap[landingKnyteId].space)
  )
    return;
  const landingPosition = {
    x: desc.position.x + activeGhost.offset.x,
    y: desc.position.y + activeGhost.offset.y
  };
  delete informationMap[desc.droppedHostKnyteId].space[desc.droppedKnoxelId];
  informationMap[landingKnyteId].space[desc.droppedKnoxelId] = landingPosition;
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  handleSpacemapChanged();
}

function initialConnectGhostRect(desc)
{
  // desc: {droppedKnoxelId, connectingKnoxelId}
  const jointKnoxelId = desc.droppedKnoxelId;
  const initialKnoxelId = desc.connectingKnoxelId;
  const jointKnyteId = knoxels[jointKnoxelId];
  const initialKnyteId = knoxels[initialKnoxelId];
  assignKnyteVectorInitial({jointKnyteId, initialKnyteId})
  assignKnoxelVectorInitial({jointKnoxelId, initialKnoxelId})
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  handleSpacemapChanged();
}

function terminalConnectGhostRect(desc)
{
  // desc: {droppedKnoxelId, connectingKnoxelId}
  const jointKnoxelId = desc.droppedKnoxelId;
  const terminalKnoxelId = desc.connectingKnoxelId;
  const jointKnyteId = knoxels[jointKnoxelId];
  const terminalKnyteId = knoxels[terminalKnoxelId];
  assignKnyteVectorTerminal({jointKnyteId, terminalKnyteId})
  assignKnoxelVectorTerminal({jointKnoxelId, terminalKnoxelId});
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  handleSpacemapChanged();
}

function initialConnectBubbleRect(desc)
{
  // desc: {droppedKnoxelId, connectingKnoxelId}
  const jointKnoxelId = desc.droppedKnoxelId;
  let initialKnoxelId = desc.connectingKnoxelId;
  const jointKnyteId = knoxels[jointKnoxelId];
  const initialKnyteId = knoxels[initialKnoxelId];
  if (initialKnoxelId && knyteVectors[jointKnyteId].initialKnyteId !== initialKnyteId)
    initialKnoxelId = undefined;
  assignKnoxelVectorInitial({jointKnoxelId, initialKnoxelId})
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  handleSpacemapChanged();
}

function terminalConnectBubbleRect(desc)
{
  // desc: {droppedKnoxelId, connectingKnoxelId}
  const jointKnoxelId = desc.droppedKnoxelId;
  let terminalKnoxelId = desc.connectingKnoxelId;
  const jointKnyteId = knoxels[jointKnoxelId];
  const terminalKnyteId = knoxels[terminalKnoxelId];
  if (terminalKnoxelId && knyteVectors[jointKnyteId].terminalKnyteId !== terminalKnyteId)
    terminalKnoxelId = undefined;
  assignKnoxelVectorTerminal({jointKnoxelId, terminalKnoxelId});
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  handleSpacemapChanged();
}

function divideActiveBubble(desc)
{
  // desc: {position}
  const dividedKnoxelId = activeBubble.knoxelId;
  const position = {
    x: desc.position.x + activeBubble.offset.x,
    y: desc.position.y + activeBubble.offset.y
  };
  divideKnoxel({dividedKnoxelId, hostKnoxelId: spaceRootElement.dataset.knoxelId, position});
  const knyteId = knoxels[activeBubble.knoxelId];
  setBubbledMode({knoxelId: activeBubble.knoxelId, knyteId, isBubbled: true});
  handleSpacemapChanged();
}

function joinActiveBubble(desc)
{
  // desc: {joinedKnoxelId}
  const stayKnoxelId = activeBubble.knoxelId;
  joinKnoxels({removeKnoxelId: desc.joinedKnoxelId, stayKnoxelId});
  handleSpacemapChanged();
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
}

function getSizeOfRecord(data, viewertype)
{
  const autosizer = document.getElementById('autosizer');
  autosizer.innerHTML = recordViewers[viewertype](data);
  const rect = autosizer.getBoundingClientRect();
  autosizer.innerHTML = '';
  return {w: rect.width, h: rect.height};
}

function getHtmlFromText(text)
{
  const autosizer = document.getElementById('autosizer');
  autosizer.textContent = text;
  const code = autosizer.innerHTML;
  autosizer.innerHTML = '';
  return code;
}

function getOnelinerRecordByData(data)
{
  const viewertype = 'oneliner';
  if (!data)
    return {data, viewertype};
  const newDataSize = getSizeOfRecord(data, viewertype);
  const padding = 2*visualTheme.rect.strokeWidth; // TODO: move padding to view function and avoid copypaste
  const size = {w: newDataSize.w + padding, h: newDataSize.h + padding};
  return {data, viewertype, size};
}

function getMultilinerRecordByData(data)
{
  const viewertype = 'multiliner';
  if (!data)
    return {data, viewertype};
  const size = getSizeOfRecord(data, viewertype);
  return {data, viewertype, size};
}

function getInteractiveRecordByData(data)
{
  const viewertype = 'interactive';
  if (!data)
    return {data, viewertype};
  const size = getSizeOfRecord(data, viewertype);
  return {data, viewertype, size};
}

function setKnyteRecordData(knyteId, recordtype, newData)
{
  if (recordtype === 'oneliner')
  {
    informationMap[knyteId].record = getOnelinerRecordByData(newData);
  }
  else if (recordtype === 'multiliner')
  {
    informationMap[knyteId].record = getMultilinerRecordByData(newData);
  }
  else if (recordtype === 'interactive')
  {
    informationMap[knyteId].record = getInteractiveRecordByData(newData);
  }
  else
    console.error('unknown recordtype: ' + recordtype);
}

function getRecordtype(record)
{
  return record ? record.viewertype : 'oneliner';
}

async function onKeyDownWindow(e)
{
  inputCodeMap[e.code] = true;
  if (document.getElementById('colorpicker').open || document.getElementById('recordeditor').open)
    return;
  const allowedBrowserCommand = (e.code === 'KeyR' && !e.altKey && e.cmdKey()) || 
    (e.code === 'KeyF' && !e.shiftKey && !e.altKey && e.cmdKey()) || 
    (e.code === 'KeyI' && !e.shiftKey && e.altKey && e.cmdKey()) || 
    (e.code === 'F12' && !e.shiftKey && !e.altKey && !e.cmdKey()) || 
    ((e.code === 'Minus' || e.code === 'Equal') && !e.shiftKey && !e.altKey && e.cmdKey());
  if (allowedBrowserCommand)
    return;
  e.stopPropagation();
  e.preventDefault();
  if (e.code === 'ArrowUp')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
      if (spaceBackElement.style.display !== 'none')
        onClickSpaceBack();
  }
  else if (e.code === 'ArrowDown')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
      if (spaceForwardElement.style.display !== 'none')
        onClickSpaceForward();
  }
  else if (e.code === 'KeyS')
  {
    if (!e.shiftKey && !e.altKey && e.cmdKey())
    {
      saveAppState(undefined, true); // no keys sorting (not diff friendly), but fast
    }
    else if (e.shiftKey && !e.altKey && e.cmdKey())
    {
      if (confirm('Sure to apply slow diff friendly save method?'))
      {
        bootLoadingElement.style.display = 'block';
        setTimeout(
          function()
          {
            saveAppState(); // sorted (diff friendly), but slow
            bootLoadingElement.style.display = 'none';
          },
          300
        );
      }
    }
  }
  else if (e.code === 'KeyG')
  {
    if (!e.shiftKey && !e.altKey && e.cmdKey())
    {
      bootLoadingElement.style.display = 'block';
      const {owner, repo, pat, fileSHA} = await fetchRepoStatus();
      if (owner && repo && pat && fileSHA)
        await saveAppState({owner, repo, pat, fileSHA}, true); // TODO: implement spinner while uploading and optional comment for uploaded changes
      else
        alert('Imposible to upload appstate without github repo connection.');
      bootLoadingElement.style.display = 'none';
    }
  }

  if (!inputOptions.handleKeyPress)
    return;

  const mouseoverTarget = document.elementFromPoint(mouseMovePagePosition.x, mouseMovePagePosition.y);
  const mouseoverElement = knoxelRect.getRootByTarget(mouseoverTarget);
  const mouseoverKnoxelId = (mouseoverElement && mouseoverElement.classList.value === 'mouseOverRect')
    ? mouseoverElement.id : null;
  if (e.code === 'Escape')
  {
    if (activeGhost.knoxelId)
      terminateGhostRect();
    else if (activeBubble.knoxelId)
      terminateBubbleRect();
    else if (activeInitialGhost.knoxelId)
      terminateInitialGhostArrow();
    else if (activeTerminalGhost.knoxelId)
      terminateTerminalGhostArrow();
    else if (activeInitialBubble.knoxelId)
      terminateInitialBubbleArrow();
    else if (activeTerminalBubble.knoxelId)
      terminateTerminalBubbleArrow();
    else if (activeFrame.element)
      terminateFrameRect();
    setNavigationControlState({
      backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
      forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
    });
  }
  else if (e.code === 'Space' && !activeBubble.knoxelId &&
    !activeInitialGhost.knoxelId && !activeTerminalGhost.knoxelId &&
    !activeInitialBubble.knoxelId && !activeTerminalBubble.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const position = steeringGear.screenToSpacePosition(mouseMovePosition);
      if (!activeGhost.knoxelId)
      {
        let knoxelId = mouseoverKnoxelId;
        let selfcontained = false;
        if (!knoxelId)
        {
          knoxelId = spaceRootElement.dataset.knoxelId;
          selfcontained = true;
        }
        const spawnSpaceRootKnoxelId = spaceRootElement.dataset.knoxelId;
        spawnGhostRect({knoxelId, spawnSpaceRootKnoxelId, position, selfcontained});
      }
      else
      {
        dropGhostRect(
          {
            droppedKnoxelId: activeGhost.knoxelId,
            droppedHostKnyteId: activeGhost.hostKnyteId,
            position,
          }
        );
        terminateGhostRect();
      }
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
  }
  else if (e.code === 'KeyB' && !activeGhost.knoxelId &&
    !activeInitialGhost.knoxelId && !activeTerminalGhost.knoxelId &&
    !activeInitialBubble.knoxelId && !activeTerminalBubble.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const position = steeringGear.screenToSpacePosition(mouseMovePosition);
      if (!activeBubble.knoxelId)
      {
        let knoxelId = mouseoverKnoxelId;
        let selfcontained = false;
        if (!knoxelId)
        {
          knoxelId = spaceRootElement.dataset.knoxelId;
          selfcontained = true;
        }
        spawnBubbleRect({knoxelId, position, selfcontained});
      }
      else
      {
        const bubbleKnyteId = knoxels[activeBubble.knoxelId];
        const overKnoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
        const overKnyteId = knoxels[overKnoxelId];
        if (
          overKnyteId === bubbleKnyteId &&
          overKnoxelId !== activeBubble.knoxelId && 
          overKnoxelId !== spaceRootElement.dataset.knoxelId
        )
          joinActiveBubble({joinedKnoxelId: overKnoxelId});
        else if (
          overKnoxelId === activeBubble.knoxelId ||
          activeBubble.knoxelId === spaceRootElement.dataset.knoxelId ||
          overKnyteId === bubbleKnyteId && overKnoxelId === spaceRootElement.dataset.knoxelId
        )
          terminateBubbleRect();
        else
          divideActiveBubble({position});
      }
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
  }
  else if (e.code === 'Enter')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      const {record} = informationMap[knyteId];
      if (record && record.viewertype !== 'oneliner')
      {
        alert('Record type not supported by simple editor. Please, run unified editor by alt+enter.');
        return;
      }
      const newData = prompt('Edit knyte value', record ? record.data : '');
      if (newData !== null)
      {
        informationMap[knyteId].record = getOnelinerRecordByData(newData);
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
    }
    else if (!e.shiftKey && e.altKey && !e.cmdKey())
    {
      function onCancelDialog(e)
      {
        e.target.removeEventListener('close', onCloseDialog);
        e.target.removeEventListener('cancel', onCancelDialog);
      }
      
      function onCloseDialog(e)
      {
        e.target.removeEventListener('close', onCloseDialog);
        e.target.removeEventListener('cancel', onCancelDialog);
        const knyteId = e.target.dataset.knyteId;
        if (!knyteId)
          return;
        const recordtype = document.getElementById('recordtype').value;
        const newData = e.target.returnValue;
        setKnyteRecordData(knyteId, recordtype, newData);
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
      
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      const {record} = informationMap[knyteId];
      const recordtype = getRecordtype(record);
      let recordeditorInput = document.getElementById('recordinput.' + recordtype);
      document.getElementById('recordinput.oneliner').value = '';
      document.getElementById('recordinput.multiliner').value = '';
      document.getElementById('recordinput.interactive').value = '';
      recordeditorInput.value = record ? record.data : '';
      document.getElementById('recordtype').value = recordtype;
      document.getElementById('recordtype').onchange();
      const recordeditorDialog = document.getElementById('recordeditor');
      recordeditorDialog.returnValue = '';
      recordeditorDialog.dataset.knyteId = knyteId;
      recordeditorDialog.addEventListener('close', onCloseDialog);
      recordeditorDialog.addEventListener('cancel', onCancelDialog);
      setTimeout(function(){recordeditorDialog.showModal(); recordeditorInput.focus();}, 0);
    }
  }
  else if (e.code === 'KeyS')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      const {record} = informationMap[knyteId];
      const newSizeText = prompt('Edit knyte record size', JSON.stringify(record && record.size ? record.size : {w: 0, h: 0}, ['w', 'h']));
      if (newSizeText)
      {
        const newSize = JSON.parse(newSizeText);
        if (newSize.w || newSize.h)
        {
          if (record)
            record.size = newSize;
          else
            informationMap[knyteId].record = {data: '', viewertype: 'oneliner', size: newSize};
        }
        else
          delete record.size;
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
    }
  }
  else if (e.code === 'KeyD')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const collapse = knoxelViews[knoxelId].collapse;
      if (collapse)
      {
        if (confirm('Sure to expand knoxel content?'))
          knoxelViews[knoxelId].collapse = false;
      }
      else
      {
        if (confirm('Sure to collapse knoxel content?'))
          knoxelViews[knoxelId].collapse = true;
      }
      if (collapse !== knoxelViews[knoxelId].collapse)
      {
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
    }
  }
  else if (e.code === 'KeyF')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      if (!activeFrame.element)
      {
        const position = steeringGear.screenToSpacePosition(mouseMovePosition);
        spawnFrameRect({position});
      }
      else
      {
        const p1 = activeFrame.origin;
        const p2 = steeringGear.screenToSpacePosition(mouseMovePosition);
        const frameRect = {
          left: Math.min(p1.x, p2.x), top: Math.min(p1.y, p2.y),
          right: Math.max(p1.x, p2.x), bottom: Math.max(p1.y, p2.y)
        };
        const groupRect = {
          left: 1000000, top: 1000000,
          right: -1000000, bottom: -1000000
        };
        const knoxelsToInsert = {};
        const hostKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
        const space = informationMap[hostKnyteId].space;
        for (let knoxelId in space)
        {
          const p = space[knoxelId];
          const {w, h} = knoxelRect.getKnoxelDimensions(knoxelId);
          const rect = {left: p.x - w/2, top: p.y - h/2, right: p.x + w/2, bottom: p.y + h/2};
          if (rectContainsRect(frameRect, rect))
          {
            knoxelsToInsert[knoxelId] = true;
            rectExpandByRect(groupRect, rect);
          }
        }
        if (Object.keys(knoxelsToInsert).length > 0)
        {
          const knyteId = knit.new();
          const color = visualTheme.rect.fillColor;
          addKnyte({knyteId, color});
          const position = {x:(groupRect.right + groupRect.left)/2, y: (groupRect.bottom + groupRect.top)/2};
          const hostKnoxelId = spaceRootElement.dataset.knoxelId;
          const hostKnyteId = knoxels[hostKnoxelId];
          for (let subKnoxelId in knoxelsToInsert)
          {
            const subPosition = informationMap[hostKnyteId].space[subKnoxelId];
            delete informationMap[hostKnyteId].space[subKnoxelId];
            informationMap[knyteId].space[subKnoxelId] = {
              x: subPosition.x - groupRect.left,
              y: subPosition.y - groupRect.top
            };
          }
          const knoxelId = addKnoxelRect({knyteId, hostKnoxelId, position});
          knoxelViews[knoxelId].color = visualTheme.frame.color;
          knoxelSpaceRoot.update();
          setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
          handleSpacemapChanged();
        }
        terminateFrameRect();
      }
    }
  }
  else if (e.code === 'KeyE')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const knoxelId = mouseoverKnoxelId;
      if (knoxelId)
      {
        const knyteId = knoxels[knoxelId];
        const knoxelPosition = steeringGear.screenToSpacePosition(mouseMovePosition);
        const spaceRootKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
        const {x, y} = informationMap[spaceRootKnyteId].space[knoxelId];
        const {leftTop, w, h} = knoxelRect.getKnoxelDimensions(knoxelId);
        const knoxelSpace = informationMap[knyteId].space;
        if (Object.keys(knoxelSpace).length > 0)
        {
          if (confirm('Sure to extract inner knoxels to space root?'))
          {
            const landingKnoxelId = spaceRootElement.dataset.knoxelId;  
            const landingKnyteId = knoxels[landingKnoxelId];
            for (let extractedKnoxelId in knoxelSpace)
            {
              if (
                extractedKnoxelId === landingKnoxelId &&
                !(extractedKnoxelId in informationMap[landingKnyteId].space)
              )
                continue;
              const landingKnoxelPosition = knoxelSpace[extractedKnoxelId];
              const landingKnoxelNewPosition = {
                x: x + landingKnoxelPosition.x - w/2 - leftTop.x,
                y: y + landingKnoxelPosition.y - h/2 - leftTop.y
              };
              delete informationMap[knyteId].space[extractedKnoxelId];
              informationMap[landingKnyteId].space[extractedKnoxelId] = landingKnoxelNewPosition;
            }
            delete informationMap[spaceRootKnyteId].space[knoxelId];
            informationMap[spaceRootKnyteId].space[knoxelId] = {x: knoxelPosition.x, y: knoxelPosition.y};
            setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
            handleSpacemapChanged();
          }
        }
        else
          alert('There is no any knoxel to extract to space root.')
      }
    }
  }
  else if (e.code === 'KeyC')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      function onCloseDialog(e)
      {
        e.target.removeEventListener('close', onCloseDialog);
        const knyteId = e.target.dataset.knyteId;
        const newColor = e.target.returnValue;
        if (newColor)
        {
          informationMap[knyteId].color = newColor;
          setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
          handleSpacemapChanged();
          setNavigationControlState({
            backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
            forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
          });
        }
      }
      
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      const {color} = informationMap[knyteId];
      const colorpickerDialog = document.getElementById('colorpicker');
      const colorpickerInput = colorpickerDialog.getElementsByTagName('input')[0];
      colorpickerInput.value = color;
      colorpickerInput.focus();
      colorpickerInput.select();
      colorpickerDialog.returnValue = '';
      colorpickerDialog.dataset.knyteId = knyteId;
      colorpickerDialog.addEventListener('close', onCloseDialog);
      setTimeout(
        function()
        {
          colorpickerDialog.showModal();
          colorpickerInput.focus();
          colorpickerInput.select();
        },
        0
      );
    }
  }
  else if (e.code === 'KeyV')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const color = knoxelViews[knoxelId].color;
      const newColor = prompt('Edit knoxel value', color);
      if (newColor !== null)
      {
        knoxelViews[knoxelId].color = newColor;
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
    }
  }
  else if (e.code === 'KeyO')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      prompt('Knoxel id:', knoxelId);
    }
  }
  else if (e.code === 'KeyY')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      prompt('Knyte id:', knyteId);
    }
  }
  else if (e.code === 'KeyZ' && !activeTerminalGhost.knoxelId && !activeGhost.knoxelId && !activeBubble.knoxelId &&
    !activeInitialBubble.knoxelId && !activeTerminalBubble.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      if (!activeInitialGhost.knoxelId)
      {
        if (mouseoverKnoxelId)
        {
          let knoxelId = mouseoverKnoxelId;
          const spawnSpaceRootKnoxelId = spaceRootElement.dataset.knoxelId;
          spawnInitialGhostArrow({knoxelId, spawnSpaceRootKnoxelId, position: mouseMovePosition});
        }
      }
      else
      {
        initialConnectGhostRect(
          {
            droppedKnoxelId: activeInitialGhost.knoxelId,
            connectingKnoxelId: mouseoverKnoxelId,
          }
        );
        terminateInitialGhostArrow();
      }
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
  }
  else if (e.code === 'KeyX' && !activeInitialGhost.knoxelId && !activeGhost.knoxelId && !activeBubble.knoxelId &&
    !activeInitialBubble.knoxelId && !activeTerminalBubble.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      if (!activeTerminalGhost.knoxelId)
      {
        if (mouseoverKnoxelId)
        {
          let knoxelId = mouseoverKnoxelId;
          const spawnSpaceRootKnoxelId = spaceRootElement.dataset.knoxelId;
          spawnTerminalGhostArrow({knoxelId, spawnSpaceRootKnoxelId, position: mouseMovePosition});
        }
      }
      else
      {
        terminalConnectGhostRect(
          {
            droppedKnoxelId: activeTerminalGhost.knoxelId,
            connectingKnoxelId: mouseoverKnoxelId,
          }
        );
        terminateTerminalGhostArrow();
      }
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
  }
  else if (e.code === 'KeyN' && !activeTerminalBubble.knoxelId && !activeGhost.knoxelId && !activeBubble.knoxelId &&
    !activeInitialGhost.knoxelId && !activeTerminalGhost.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      if (!activeInitialBubble.knoxelId)
      {
        if (mouseoverKnoxelId)
        {
          let knoxelId = mouseoverKnoxelId;
          const spawnSpaceRootKnoxelId = spaceRootElement.dataset.knoxelId;
          spawnInitialBubbleArrow({knoxelId, spawnSpaceRootKnoxelId, position: mouseMovePosition});
        }
      }
      else
      {
        initialConnectBubbleRect(
          {
            droppedKnoxelId: activeInitialBubble.knoxelId,
            connectingKnoxelId: mouseoverKnoxelId,
          }
        );
        terminateInitialBubbleArrow();
      }
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
  }
  else if (e.code === 'KeyM' && !activeInitialBubble.knoxelId && !activeGhost.knoxelId && !activeBubble.knoxelId &&
    !activeInitialGhost.knoxelId && !activeTerminalGhost.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      if (!activeTerminalBubble.knoxelId)
      {
        if (mouseoverKnoxelId)
        {
          let knoxelId = mouseoverKnoxelId;
          const spawnSpaceRootKnoxelId = spaceRootElement.dataset.knoxelId;
          spawnTerminalBubbleArrow({knoxelId, spawnSpaceRootKnoxelId, position: mouseMovePosition});
        }
      }
      else
      {
        terminalConnectBubbleRect(
          {
            droppedKnoxelId: activeTerminalBubble.knoxelId,
            connectingKnoxelId: mouseoverKnoxelId,
          }
        );
        terminateTerminalBubbleArrow();
      }
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
  }
  else if (e.code === 'KeyJ')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const jumpTargetKnoxelId = prompt('Enter knoxel id to jump:');
      if (jumpTargetKnoxelId && (jumpTargetKnoxelId in knoxels))
        jumpToKnoxel(jumpTargetKnoxelId);
    }
  }
  else if (e.code === 'KeyK')
  {
    if (!e.shiftKey && !e.altKey && !e.cmdKey())
    {
      const targetKnoxelId = mouseoverKnoxelId;
      const targetKnyteId = knoxels[targetKnoxelId];
      const matchKnoxels = [targetKnoxelId];
      for (const knoxelId in knoxels)
      {
        if (knoxelId === targetKnoxelId)
          continue;
        const knyteId = knoxels[knoxelId];
        if (knyteId === targetKnyteId)
          matchKnoxels.push(knoxelId);
      }
      console.log('knoxels of knyte ' + targetKnyteId + ':');
      console.log(matchKnoxels);
      alert('list of ' + matchKnoxels.length + ' knoxels of the knyte logged to console');
    }
  }
}

async function onKeyUpWindow(e)
{
  delete inputCodeMap[e.code];
}

function jumpToKnoxel(targetKnoxelId)
{
  // set space root to the space containing target knoxel

  // check if we are already in the right space
  let hostKnyteId;
  const spaceRootKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
  const spaceRootSpace = informationMap[spaceRootKnyteId].space;
  if (spaceRootSpace && (targetKnoxelId in spaceRootSpace))
    hostKnyteId = spaceRootKnyteId;
  else
  {
    alert('knoxel not found in the current space');
    return;
    // TODO: ask if user want to jump to another space
    // TODO: find the space containing target knoxel
    // TODO: jump to this space
  }

  // jump to target knoxel inside of thr current space
  const targetKnoxelPosition = informationMap[hostKnyteId].space[targetKnoxelId];
  const width = parseFloat(spaceRootElement.getAttribute('width'));
  const height = parseFloat(spaceRootElement.getAttribute('height'));
  const {w, h} = knoxelRect.getKnoxelDimensions(targetKnoxelId);
  const screenOccupationCoefficient = 0.9;
  const zoomW = (w + 0.5 * visualTheme.rect.strokeWidth) / (screenOccupationCoefficient * width);
  const zoomH = (h + 0.5 * visualTheme.rect.strokeWidth) / (screenOccupationCoefficient * height);
  const zoom = Math.max(zoomW, zoomH);
  steeringGear.setZoom(zoom);
  const x = width/2 - targetKnoxelPosition.x/zoom;
  const y = height/2 - targetKnoxelPosition.y/zoom;
  steeringGear.setPan({x, y});
}

function onMouseWheelWindow(e)
{
  if (e.ctrlKey)
  {
    // disable pinch zoom by touchpad
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  if (document.getElementById('colorpicker').open || document.getElementById('recordeditor').open)
    return;
  if (!e.shiftKey && !e.altKey && !e.cmdKey())
  {
    const panDelta = {x: e.wheelDeltaX, y: e.wheelDeltaY};
    steeringGear.pan(panDelta);
    e.stopPropagation();
    e.preventDefault();
  }
  if (e.shiftKey && !e.altKey && !e.cmdKey())
  {
    steeringGear.zoom(mouseMovePosition, e.wheelDelta);
    e.stopPropagation();
    e.preventDefault();
  }
  if (activeFrame.element)
  {
    const position = steeringGear.screenToSpacePosition(mouseMovePosition);
    updateFrameRect({position});
  }
}

const codeTemplates = {
  runBlock: {
    ready: function(knyteId, type) {
      const checks = {
        init: '',
        failed: '\t<span title="check" style="padding: 2px; background-color: ' + visualThemeColors.fail +';">error</span>\n',
      };
      return '<div style="width: 200px; height: 24px; margin: 8px;">\n' +
        '\t<button\n' +
          '\t\tdata-knyte-id="' + knyteId + '"\n' +
          '\t\tonclick="event.stopPropagation(); runBlockHandleClick(this.dataset.knyteId);"\n' +
          '\t\tonfocus="this.blur();"\n' +
        '\t>\n' +
          '\t\trun\n' +
        '\t</button>\n' +
        '\t<span title="status">ready</span>\n' +
        checks[type] +
      '</div>';
    },
    busy: '<div style="width: 200px; height: 24px; margin: 8px;">\n' +
      '\t<button disabled>run</button>\n' +
      '\t<span title="status">busy</span>\n' +
      '\t<span title="check" style="padding: 2px;">...</span>\n' +
    '</div>',
  },
};

function getConnectsByDataMatchFunction(knyteId, match, token, type)
{
  const result = [];
  let connects = knyteConnects;
  if (type === 'initial')
    connects = knyteInitialConnects;
  else if (type === 'terminal')
    connects = knyteTerminalConnects;
  const connectedKnytes = connects[knyteId];
  for (let connectedKnyteId in connectedKnytes)
  {
    const {record} = informationMap[connectedKnyteId];
    if (record && match(record.data, token))
      result.push(connectedKnyteId);
  }
  return result;
}

function isString(s)
{
  return s !== null && s !== undefined && s.constructor === String;
}

function escapeStringToCode(s) {
  return s.replace(/\\/g, '\\\\').replace(/\"/g, '\\\"').replace(/\n/g, '\\n');
}

function getHostedKnyteId(knyteId)
{
  const hostedKnoxels = informationMap[knyteId].space;
  const hostedKnytes = {};
  for (let hostedKnoxelId in hostedKnoxels)
  {
    const hostedKnyteId = knoxels[hostedKnoxelId];
    hostedKnytes[hostedKnyteId] = true;
  }
  if (Object.keys(hostedKnytes).length === 1)
    return Object.keys(hostedKnytes)[0];
  return null;
}

function logicBlockHandleClick(knyteId)
{
  logicReset(knyteId);
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  refreshActiveRect({screenPosition: mouseMovePosition});
  handleSpacemapChanged();
}

function logicReset(logicKnyteId)
{
  function resetTransparentOutline(knoxelId)
  {
    const {color} = knoxelViews[knoxelId];
    if (color.length > 7)
      knoxelViews[knoxelId].color = color.slice(0, 7);
  }

  const hostedKnoxels = informationMap[logicKnyteId].space;
  for (let hostedKnoxelId in hostedKnoxels)
  {
    const knyteId = knoxels[hostedKnoxelId];
    resetTransparentOutline(hostedKnoxelId);
    const hostedKnoxels2 = informationMap[knyteId].space;
    for (let hostedKnoxelId2 in hostedKnoxels2)
      resetTransparentOutline(hostedKnoxelId2);
    const {record} = informationMap[knyteId];
    const {initialKnyteId, terminalKnyteId} = knyteVectors[knyteId];
    if (initialKnyteId && terminalKnyteId && record && (record.data === '-' || record.data === '+'))
      setKnyteRecordData(knyteId, 'oneliner', '.');
  }
}

function runBlockHandleClick(knyteId)
{
  function onComplete(success, nextKnyteId)
  {
    const newData = codeTemplates.runBlock.ready(knyteId, success ? 'init' : 'failed');
    setKnyteRecordData(knyteId, 'interactive', newData);
    setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
    refreshActiveRect({screenPosition: mouseMovePosition});
    handleSpacemapChanged();
    
    if (success && nextKnyteId)
      runBlockHandleClick(nextKnyteId);
  }
  
  function matchToken(data, token)
  {
    return data === token;
  }
  
  function matchDataParameter(data)
  {
    return data.length > 2 && data[0] === '(' && data[data.length-1] === ')';
  }

  function matchKnoxelParameter(data)
  {
    // can't use [] or {} to don't mismatch with json arrays and objects
    // don't want to use <> because of poor metaphora
    return data.length > 2 && data[0] === '|' && data[data.length-1] === '|';
  }

  function matchCaseParameter(data)
  {
    return data.length > 1 && data[0] === '=';
  }

  function extractParameterName(data)
  {
    return data.substr(1, data.length-2);
  }

  function extractCaseValue(data)
  {
    return data.substr(1, data.length-1);
  }

  const typeValidators = {
    string: function(value) {return true;},
    number: function(value) {
      return !isNaN(value) && 
        value !== 'true' && value !== 'false' && value !== true && value !== false;
    },
    bool: function(value) {
      return value === 'true' || value === 'false' || value === true || value === false;
    },
    json: function(value) {
      let success = false;
      try
      {
        if (isString(value))
          JSON.parse(value);
        success = true;
      }
      catch (e)
      {
        console.warn(e);
      }
      return success;
    },
  };
  
  function getValueCode(typeValidator, value)
  {
    if (typeValidator === typeValidators.string)
    {
      if (value === undefined || value === '')
        return '""';
      return '"' + escapeStringToCode(value) + '"';
    }
    return value;
  }

  function logicCallHandler(logicKnyteId)
  {
    logicReset(logicKnyteId);
    return logicCompute(logicKnyteId);
  }

  function logicCompute(logicKnyteId)
  {
    function markProcessedLink(knyteId, success)
    {
      setKnyteRecordData(knyteId, 'oneliner', success ? '+' : '-');
    }

    function setInnactiveKnoxelView(knoxelId)
    {
      function setTransparentOutline(knoxelId)
      {
        const {color} = knoxelViews[knoxelId];
        knoxelViews[knoxelId].color = color + '40';
      }

      setTransparentOutline(knoxelId);
      const knyteId = knoxels[knoxelId];
      const hostedKnoxels = informationMap[knyteId].space;
      for (let hostedKnoxelId in hostedKnoxels)
        setTransparentOutline(hostedKnoxelId);
    }

    // TODO: implement semantic-code entities link via standard parameters
    const logicSemantics = {
      blocks: {
        root: '0f51a068-5ec8-4de1-b24c-f8aec06d00bb',
      },
      operators: {
        not: '8669eb2f-2d20-48c0-88ca-27c4e7a44ef2',
        and: '50b3066e-d0fd-4efc-806f-4f363a106092',
        or: '7dde3e82-2c0a-45e5-9bc1-04bb34034514',
        xor: 'de329bdf-eab1-4c61-a1d5-1d5e7810a3a5',
      },
    };

    function isLogicOperator(knyteId)
    {
      for (let operator in logicSemantics.operators)
      {
        const operatorKnyteId = logicSemantics.operators[operator];
        if (operatorKnyteId === knyteId)
          return true;
      }
      return false;
    }

    function computeValueByOperatorId(operatorKnyteId, incomeValues)
    {
      // get operator by knyte id
      let operator = null;
      for (let op in logicSemantics.operators)
      {
        const knyteId = logicSemantics.operators[op];
        if (operatorKnyteId === knyteId)
          operator = op;
      }
      if (operator === 'not')
      {
        if (incomeValues.length === 1)
          if (incomeValues[0] === true)
            return false;
          else if (incomeValues[0] === false)
            return true;
        return undefined;
      }
      else if (operator === 'and')
      {
        for (let i = 0; i < incomeValues.length; ++i)
        {
          if (incomeValues[i] === false)
            return false;
          if (incomeValues[i] === undefined)
            return undefined;
        }
        return incomeValues.length > 0 ? true : undefined;
      }
      else if (operator === 'or')
      {
        let result = false;
        for (let i = 0; i < incomeValues.length; ++i)
        {
          if (incomeValues[i] === true)
            result = true;
          if (incomeValues[i] === undefined)
            return undefined;
        }
        return incomeValues.length > 0 ? result : undefined;
      }
      else if (operator === 'xor')
      {
        let trueCounter = 0;
        for (let i = 0; i < incomeValues.length; ++i)
        {
          if (incomeValues[i] === true)
            ++trueCounter;
          if (incomeValues[i] === undefined)
            return undefined;
        }
        return incomeValues.length > 0 ? (trueCounter === 1) : undefined;
      }
      return undefined;
    }

    const hostedKnoxels = informationMap[logicKnyteId].space;
    const succeedKnytes = {};
    const dismissedKnytes = {};
    // get root
    const rootKnytes = {};
    for (let knoxelId in hostedKnoxels)
    {
      const knyteId = knoxels[knoxelId];
      if (getHostedKnyteId(knyteId) === logicSemantics.blocks.root)
        rootKnytes[knyteId] = true;
    }
    if (Object.keys(rootKnytes).length !== 1)
      return {complete: false, error: 'logic block must have 1 root block'};
    const rootKnyteId = Object.keys(rootKnytes)[0];
    succeedKnytes[rootKnyteId] = true;
    const rootLinks = getConnectsByDataMatchFunction(rootKnyteId, matchToken, '.', 'initial');
    // get groups
    const groupHostKnytes = {}; // {group host knyte id --> group knyte id}
    for (let i = 0; i < rootLinks.length; ++i)
    {
      const linkId = rootLinks[i];
      const groupHostId = knyteVectors[linkId].terminalKnyteId;
      const groupId = getHostedKnyteId(groupHostId);
      if (groupId)
      {
        groupHostKnytes[groupHostId] = groupId;
        succeedKnytes[linkId] = true;
        succeedKnytes[groupHostId] = true;
        markProcessedLink(linkId, true);
      }
      else
      {
        dismissedKnytes[linkId] = true;
        dismissedKnytes[groupHostId] = true;
        markProcessedLink(linkId, false);
      }
    }
    // group to values
    const groupValues = {}; // {group knyte id: {value level 1 knyte id --> value level 2 knyte id}}
    for (let groupHostId in groupHostKnytes)
    {
      const groupId = groupHostKnytes[groupHostId];
      const groupLinks = getConnectsByDataMatchFunction(groupId, matchToken, '=', 'initial');
      for (let i = 0; i < groupLinks.length; ++i)
      {
        const linkId = groupLinks[i];
        const valueLevel1HostId = knyteVectors[linkId].terminalKnyteId;
        const valueLevel1Id = getHostedKnyteId(valueLevel1HostId);
        const valueLinks = getConnectsByDataMatchFunction(valueLevel1HostId, matchToken, '=', 'initial');
        for (let j = 0; j < valueLinks.length; ++j)
        {
          const linkId = valueLinks[j];
          const valueLevel2HostId = knyteVectors[linkId].terminalKnyteId;
          const valueLevel2Id = getHostedKnyteId(valueLevel2HostId);
          if (!(groupId in groupValues))
            groupValues[groupId] = {};
          groupValues[groupId][valueLevel1Id] = valueLevel2Id;
        }
      }
    }
    const valueStates = {};
    for (let groupHostId in groupHostKnytes)
    {
      const groupId = groupHostKnytes[groupHostId];
      const groupHostLinks = getConnectsByDataMatchFunction(groupHostId, matchToken, '.', 'initial');
      for (let i = 0; i < groupHostLinks.length; ++i)
      {
        const linkId = groupHostLinks[i];
        const valueLevel1HostId = knyteVectors[linkId].terminalKnyteId;
        const valueLevel1Id = getHostedKnyteId(valueLevel1HostId);
        const valueHostLinks = getConnectsByDataMatchFunction(valueLevel1HostId, matchToken, '.', 'initial');
        for (let j = 0; j < valueHostLinks.length; ++j)
        {
          const linkId = valueHostLinks[j];
          const valueLevel2HostId = knyteVectors[linkId].terminalKnyteId;
          const valueLevel2Id = getHostedKnyteId(valueLevel2HostId);
          if (groupValues[groupId] && groupValues[groupId][valueLevel1Id] && groupValues[groupId][valueLevel1Id] === valueLevel2Id)
          {
            valueStates[valueLevel2HostId] = true;
            succeedKnytes[linkId] = true;
            succeedKnytes[valueLevel2HostId] = true;
            markProcessedLink(linkId, true);
          }
          else
          {
            valueStates[valueLevel2HostId] = false;
            dismissedKnytes[linkId] = true;
            dismissedKnytes[valueLevel2HostId] = true;
            markProcessedLink(linkId, false);
          }
        }
        if (groupValues[groupId] && groupValues[groupId][valueLevel1Id])
        {
          succeedKnytes[linkId] = true;
          succeedKnytes[valueLevel1HostId] = true;
          markProcessedLink(linkId, true);
        }
        else
        {
          dismissedKnytes[linkId] = true;
          dismissedKnytes[valueLevel1HostId] = true;
          markProcessedLink(linkId, false);
        }
      }
    }
    // get operators and results
    const operatorHostKnytes = {}; // {operator host knyte id --> operator knyte id}
    const resultHostKnytes = {}; // {result host knyte id --> result knyte id}
    for (let hostedKnoxelId in hostedKnoxels)
    {
      const hostKnyteId = knoxels[hostedKnoxelId];
      const knyteId = getHostedKnyteId(hostKnyteId);
      if (isLogicOperator(knyteId))
        operatorHostKnytes[hostKnyteId] = knyteId;
      else
        resultHostKnytes[hostKnyteId] = knyteId;
    }
    // process operators
    const maxComputeIterations = 128;
    let computeIteration = 0;
    while (computeIteration < maxComputeIterations)
    {
      let operatorsComputed = 0;
      for (operatorHostKnyteId in operatorHostKnytes)
      {
        if (valueStates[operatorHostKnyteId] !== undefined)
          continue;
        const incomeValues = [];
        const incomeValueKnytes = getConnectsByDataMatchFunction(operatorHostKnyteId, matchToken, '.', 'terminal');
        for (let i = 0; i < incomeValueKnytes.length; ++ i)
        {
          const linkId = incomeValueKnytes[i];
          const incomeValueHostId = knyteVectors[linkId].initialKnyteId;
          incomeValues.push(valueStates[incomeValueHostId]);
        }
        const operatorKnyteId = getHostedKnyteId(operatorHostKnyteId);
        const operatorValue = computeValueByOperatorId(operatorKnyteId, incomeValues);
        if (operatorValue !== undefined)
        {
          ++operatorsComputed;
          valueStates[operatorHostKnyteId] = operatorValue;
          if (operatorValue)
            succeedKnytes[operatorHostKnyteId] = true;
          else
            dismissedKnytes[operatorHostKnyteId] = true;
          for (let i = 0; i < incomeValueKnytes.length; ++ i)
          {
            const linkId = incomeValueKnytes[i];
            const incomeValueHostId = knyteVectors[linkId].initialKnyteId;
            if (valueStates[incomeValueHostId] === true)
            {
              succeedKnytes[linkId] = true;
              markProcessedLink(linkId, true);
            }
            else
            {
              dismissedKnytes[linkId] = true;
              markProcessedLink(linkId, false);
            }
          }
        }
      }
      if (!operatorsComputed)
        break;
      ++computeIteration;
    }
    // set results
    const solution = {}; // host knyte id --> domain knyte id
    const maxResultIterations = 128;
    let resultIteration = 0;
    while (resultIteration < maxResultIterations)
    {
      let resultsComputed = 0;
      for (resultHostKnyteId in resultHostKnytes)
      {
        if (valueStates[resultHostKnyteId] !== undefined)
          continue;
        const incomeValueKnytes = getConnectsByDataMatchFunction(resultHostKnyteId, matchToken, '.', 'terminal');
        if (incomeValueKnytes.length !== 1)
          continue;
        const incomeValueLinkId = incomeValueKnytes[0];
        const incomeValueHostId = knyteVectors[incomeValueLinkId].initialKnyteId;
        const incomeValue = valueStates[incomeValueHostId];
        if (incomeValue === undefined)
          continue;
        ++resultsComputed;
        valueStates[resultHostKnyteId] = incomeValue;
        if (incomeValue)
        {
          succeedKnytes[incomeValueLinkId] = true;
          succeedKnytes[resultHostKnyteId] = true;
          markProcessedLink(incomeValueLinkId, true);
          const resultKnyteId = resultHostKnytes[resultHostKnyteId];
          if (resultKnyteId)
            solution[resultHostKnyteId] = resultKnyteId;
        }
        else
        {
          dismissedKnytes[incomeValueLinkId] = true;
          dismissedKnytes[resultHostKnyteId] = true;
          markProcessedLink(incomeValueLinkId, false);
        }
      }
      if (!resultsComputed)
        break;
      ++resultIteration;
    }
    // set innactive knoxels view
    for (let knoxelId in hostedKnoxels)
    {
      const knyteId = knoxels[knoxelId];
      if (knyteId in dismissedKnytes)
        setInnactiveKnoxelView(knoxelId);
    }
    // return result
    return {complete: true, solution};
  }

  const newData = codeTemplates.runBlock.busy;
  setKnyteRecordData(knyteId, 'interactive', newData);
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  refreshActiveRect({screenPosition: mouseMovePosition});
  handleSpacemapChanged();
  
  const codeKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'code', 'terminal');
  const codeLinkKnyteId = codeKnytes[0];
  const codeKnyteId = codeLinkKnyteId ? knyteVectors[codeLinkKnyteId].initialKnyteId : undefined;
  const codeRecord = codeKnyteId ? informationMap[codeKnyteId].record : undefined;
  let codeText = codeRecord ? codeRecord.data : '';

  const logicKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'logic', 'terminal');
  const logicLinkKnyteIds = logicKnytes && logicKnytes.length ? logicKnytes : undefined;
  const logicKnyteIds = logicLinkKnyteIds ? logicLinkKnyteIds.map((value, index) => knyteVectors[value].initialKnyteId) : undefined;

  const nextKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'next', 'initial');
  const nextLinkKnyteId = nextKnytes[0];
  const nextKnyteId = nextLinkKnyteId ? knyteVectors[nextLinkKnyteId].terminalKnyteId : undefined;
  const inputKnytes = getConnectsByDataMatchFunction(knyteId, matchDataParameter, undefined, 'terminal');
  const outputKnytes = getConnectsByDataMatchFunction(knyteId, matchDataParameter, undefined, 'initial');

  const ifKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'if', 'terminal');
  const ifLinkKnyteId = ifKnytes[0];
  const ifKnyteId = ifLinkKnyteId ? knyteVectors[ifLinkKnyteId].initialKnyteId : undefined;
  const ifRecord = ifKnyteId ? informationMap[ifKnyteId].record : undefined;
  const ifText = ifRecord ? ifRecord.data : '';
  const elseKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'else', 'initial');
  const elseLinkKnyteId = elseKnytes[0];
  const elseKnyteId = elseLinkKnyteId ? knyteVectors[elseLinkKnyteId].terminalKnyteId : undefined;
  const caseKnytes = getConnectsByDataMatchFunction(knyteId, matchCaseParameter, undefined, 'initial');

  const cases = {};
  for (let i = 0; i < caseKnytes.length; ++i)
  {
    const caseLinkKnyteId = caseKnytes[i];
    const caseKnyteId = caseLinkKnyteId ? knyteVectors[caseLinkKnyteId].terminalKnyteId: undefined;
    const caseRecord = informationMap[caseLinkKnyteId].record;
    const caseValue = caseRecord ? extractCaseValue(caseRecord.data) : undefined;
    if (caseValue !== undefined && caseKnyteId)
      cases[caseValue] = caseKnyteId;
  }
  
  const namesSequence = [];
  const inputNamesSequence = [];
  const inputs = {};
  for (let i = 0; i < inputKnytes.length; ++i)
  {
    const inputLinkKnyteId = inputKnytes[i];
    const inputKnyteId = inputLinkKnyteId ? knyteVectors[inputLinkKnyteId].initialKnyteId : undefined;
    const inputLinkRecord = inputLinkKnyteId ? informationMap[inputLinkKnyteId].record : undefined;
    const inputRecord = inputKnyteId ? informationMap[inputKnyteId].record : undefined;
    const inputValue = inputRecord ? inputRecord.data : '';
    const inputName = inputLinkRecord ? extractParameterName(inputLinkRecord.data) : '';
    if (inputName)
    {
      inputs[inputName] = inputValue;
      namesSequence.push(inputName);
      inputNamesSequence.push(inputName);
    }
  }
  const outputNamesSequence = [];
  const outputs = {};
  const outputNameToKnyteMap = {};
  for (let i = 0; i < outputKnytes.length; ++i)
  {
    const outputLinkKnyteId = outputKnytes[i];
    const outputKnyteId = outputLinkKnyteId ? knyteVectors[outputLinkKnyteId].terminalKnyteId : undefined;
    const outputLinkRecord = outputLinkKnyteId ? informationMap[outputLinkKnyteId].record : undefined;
    const outputRecord = outputKnyteId ? informationMap[outputKnyteId].record : undefined;
    const outputValue = outputRecord ? outputRecord.data : '';
    const outputName = outputLinkRecord ? extractParameterName(outputLinkRecord.data) : '';
    if (outputName)
    {
      outputs[outputName] = outputValue;
      namesSequence.push(outputName);
      outputNamesSequence.push(outputName);
      const name = outputName.split(':')[0];
      outputNameToKnyteMap[name] = outputKnyteId;
    }
  }
  let runComplete = false;
  try
  {
    if (codeKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 code links');
    if (nextKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 next links');
    if (ifKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 if links');
    if (caseKnytes.length !== Object.keys(cases).length)
      throw Error('run block knyte ' + knyteId + ' has duplicated case links');
    if (elseKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 else links');
    if (!ifKnytes.length && (caseKnytes.length || elseKnytes.length))
      throw Error('run block knyte ' + knyteId + ' has case/else links without if link');
    if (ifKnytes.length || caseKnytes.length || elseKnytes.length)
    {
      if (codeKnytes.length)
        throw Error('run block knyte ' + knyteId + ' has mixed code and if-cases-else links');
      if (logicKnytes.length)
        throw Error('run block knyte ' + knyteId + ' has mixed logic and if-cases-else links');
      if (nextKnytes.length)
        throw Error('run block knyte ' + knyteId + ' has mixed next and if-cases-else links');
    }
    if (logicKnytes.length && codeKnytes.length)
      throw Error('run block knyte ' + knyteId + ' has mixed code and logic links');
    const namesMap = {};
    for (let i = 0; i < namesSequence.length; ++i)
    {
      const nameType = namesSequence[i].split(':');
      const name = nameType[0];
      const type = nameType[1];
      if (name in namesMap)
        throw Error('duplicated parameter name: ' + name);
      const typeValidator = type ? typeValidators[type] : typeValidators.string;
      if (!typeValidator)
        throw Error('type validator not found for (' + namesSequence[i] + ')');
      namesMap[name] = {type, typeValidator};
    }
    let formalParametersList = '';
    let actualParametersList = '';
    for (let i = 0; i < inputNamesSequence.length; ++i)
    {
      const name = inputNamesSequence[i].split(':')[0];
      formalParametersList += '"' + name + '", ';
      const {typeValidator} = namesMap[name];
      const value = inputs[inputNamesSequence[i]];
      if (!typeValidator(value))
        throw Error('invalid value for (' + inputNamesSequence[i] + '): ' + value);
      actualParametersList += (i > 0 ? ', ' : '') + getValueCode(typeValidator, value);
    }
    if (outputNamesSequence.length)
    {
      let outputParametersDefinition = 'let ';
      let outputParametersReturn = '\nreturn {';
      for (let i = 0; i < outputNamesSequence.length; ++i)
      {
        const name = outputNamesSequence[i].split(':')[0];
        outputParametersDefinition += (i > 0 ? ', ' : '') + name;
        outputParametersReturn += (i > 0 ? ', ' : '') + name;
      }
      outputParametersDefinition += '; // autogenerated code line\n';
      outputParametersReturn += '}; // autogenerated code line';
      codeText = outputParametersDefinition + codeText + outputParametersReturn;
    }
    const useStrict = '"use strict";\n';
    if (ifKnyteId)
    {
      const evalConditionKey = 'if-case-else' + formalParametersList + ifText;
      const evalConditionText = 'new Function(' + formalParametersList + 'useStrict + "return (" + ifText + ");")';
      if (!(knyteId in knyteEvalCode))
        knyteEvalCode[knyteId] = {};
      if (!(evalConditionKey in knyteEvalCode[knyteId]))
        knyteEvalCode[knyteId][evalConditionKey] = eval(evalConditionText);
      const conditionFunction = knyteEvalCode[knyteId][evalConditionKey];
      runBlockBusyList[knyteId] = true;
      setTimeout(
        function()
        {
          delete runBlockBusyList[knyteId];
          let conditionComplete = false;
          let conditionKnyteId;
          try
          {
            const result = eval('conditionFunction(' + actualParametersList + ')');
            conditionKnyteId = cases[result] ? cases[result] : elseKnyteId;
            conditionComplete = true;
          }
          finally
          {
            onComplete(conditionComplete, conditionKnyteId);
          }
        }, 
        runBlockDelay
      );
    }
    else if (logicKnyteIds)
    {
      runBlockBusyList[knyteId] = true;
      setTimeout(
        function()
        {
          delete runBlockBusyList[knyteId];
          const logicResult = {complete: true, solution: {}};
          for (let i = 0; i < logicKnyteIds.length; ++i)
          {
            const logicKnyteId = logicKnyteIds[i];
            const logicResultPart = logicCallHandler(logicKnyteId);
            logicResult.complete = logicResult.complete && logicResultPart.complete;
            if (logicResultPart.complete)
              for (let keyId in logicResultPart.solution)
                logicResult.solution[keyId] = logicResultPart.solution[keyId];
          }
          // write solution to output
          if (namesMap.solution && namesMap.solution.type === 'json')
          {
            const resultValue = logicResult.complete
              ? JSON.stringify(logicResult.solution)
              : '{}';
            const resultKnyteId = outputNameToKnyteMap.solution;
            const {record} = informationMap[resultKnyteId];
            const recordtype = getRecordtype(record);
            setKnyteRecordData(resultKnyteId, recordtype, resultValue);
            onComplete(logicResult.complete, nextKnyteId);
          }
          else
            onComplete(false);
          if (!logicResult.complete)
            throw Error(logicResult.error);
          if (!namesMap.solution)
            throw Error('logic solution output not found');
          if (namesMap.solution.type !== 'json')
            throw Error('logic solution output must have json type');
        },
        runBlockDelay
      );
    }
    else
    {
      const evalKey = 'code-next' + formalParametersList + codeText;
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const evalText = 'new AsyncFunction(' + formalParametersList + 'useStrict + codeText)';
      if (!(knyteId in knyteEvalCode))
        knyteEvalCode[knyteId] = {};
      if (!(evalKey in knyteEvalCode[knyteId]))
        knyteEvalCode[knyteId][evalKey] = eval(evalText);
      const codeFunction = knyteEvalCode[knyteId][evalKey];
      runBlockBusyList[knyteId] = true;
      setTimeout(
        function()
        {
          let promiseComplete = false;
          try
          {
            let codeComplete = false;
            const promiseResults = eval('codeFunction(' + actualParametersList + ')');
            promiseResults.then(
              function(results)
              {
                let gotOutput = false;
                for (let resultName in results)
                {
                  const {type, typeValidator} = namesMap[resultName];
                  const value = results[resultName];
                  if (!typeValidator(value))
                    throw Error('invalid value for (' + resultName + ':' + type + '): ' + value);
                }
                for (let resultName in results)
                {
                  let resultValue = results[resultName];
                  if (resultValue === undefined)
                    continue;
                  if (!isString(resultValue))
                    resultValue = JSON.stringify(resultValue);
                  const resultKnyteId = outputNameToKnyteMap[resultName];
                  const {record} = informationMap[resultKnyteId];
                  const recordtype = getRecordtype(record);
                  setKnyteRecordData(resultKnyteId, recordtype, resultValue);
                  gotOutput = true;
                }
                if (gotOutput)
                {
                  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
                  handleSpacemapChanged();
                }
                codeComplete = true;
              }
            ).finally(
              function()
              {
                delete runBlockBusyList[knyteId];
                onComplete(codeComplete, nextKnyteId);
              }
            );
            promiseComplete = true;
          }
          finally
          {
            if (!promiseComplete)
            {
              delete runBlockBusyList[knyteId];
              onComplete(false);
            }
          }
        }, 
        runBlockDelay
      );
    }
    runComplete = true;
  }
  finally
  {
    if (!runComplete)
    {
      const newData = codeTemplates.runBlock.ready(knyteId, 'failed');
      setKnyteRecordData(knyteId, 'interactive', newData);
      setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
      refreshActiveRect({screenPosition: mouseMovePosition});
      handleSpacemapChanged();
    }
  }
}

function spacemapChangedHandler()
{
  // do it for spacemap spaces only
  if (knoxels[spaceRootElement.dataset.knoxelId] !== knoxels[spacemapKnoxelId])
    return;

  // rebuild spacemapKnoxelId space: add knoxels for all new knytes; recreate all arrows.

  // build new knytes map
  const spacemapKnyteId = knoxels[spacemapKnoxelId];
  const spacemapSpace = informationMap[spacemapKnyteId].space;
  const spacemapKnytes = {};
  const knyteIdToKnoxelIdMap = {};
  for (let knoxelId in spacemapSpace)
  {
    const knyteId = knoxels[knoxelId];
    spacemapKnytes[knyteId] = true;
    if (!knyteIdToKnoxelIdMap[knyteId])
      knyteIdToKnoxelIdMap[knyteId] = {};
    knyteIdToKnoxelIdMap[knyteId][knoxelId] = true;
  }
  const newKnytes = {};
  for (let knyteId in knyteVectors)
    if (!(knyteId in spacemapKnytes))
      newKnytes[knyteId] = true;
  
  // create new knoxel for every new knyte
  const position = {x: 3 * visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight};
  for (let knyteId in newKnytes)
  {
    const knoxelId = knit.new();
    addKnoxel({hostKnyteId: spacemapKnyteId, knyteId, knoxelId, position});
    knyteIdToKnoxelIdMap[knyteId] = {};
    knyteIdToKnoxelIdMap[knyteId][knoxelId] = true;
  }
  
  // build arrows
  cleanupArrows();
  const arrowedKnoxelPairs = {};
  for (let knoxelId in knoxels)
  {
    const knyteId = knoxels[knoxelId];
    if (knyteId === spacemapKnyteId)
      continue;
    const space = informationMap[knyteId].space;
    for (let nestedKnoxelId in space)
    {
      const nestedKnyteId = knoxels[nestedKnoxelId];
      const initialKnoxelIds = knyteIdToKnoxelIdMap[knyteId];
      const terminalKnoxelIds = knyteIdToKnoxelIdMap[nestedKnyteId];
      for (let initialKnoxelId in initialKnoxelIds)
        for (let terminalKnoxelId in terminalKnoxelIds)
        {
          const knoxelPair = initialKnoxelId + '+' + terminalKnoxelId;
          if (knoxelPair in arrowedKnoxelPairs)
            continue;
          addOriginsArrow({id: knit.new(), initialKnoxelId, terminalKnoxelId});
          arrowedKnoxelPairs[knoxelPair] = true;
        }
    }
  }
}

function steeringChangedHandler()
{
  if (activeGhost.knoxelId)
    knoxelRect.updateArrowShape(activeGhost.knoxelId, mouseMovePosition, true);
  if (activeInitialGhost.knoxelId)
    var {knoxelId, element} = activeInitialGhost;
  if (activeTerminalGhost.knoxelId)
    var {knoxelId, element} = activeTerminalGhost;
  if (activeInitialBubble.knoxelId)
    var {knoxelId, element} = activeInitialBubble;
  if (activeTerminalBubble.knoxelId)
    var {knoxelId, element} = activeTerminalBubble;
  if (knoxelId)
    knoxelArrow.updateElement({knoxelId, element});
}

async function onLoadBody(e)
{
  // init space root element
  bootLoadingElement = document.getElementsByClassName('bootLoading')[0];
  spaceRootElement = document.getElementsByClassName('spaceRoot')[0];
  spaceBackElement = document.getElementsByClassName('spaceBack')[0];
  spaceForwardElement = document.getElementsByClassName('spaceForward')[0];
  spaceMapElement = document.getElementsByClassName('spaceMap')[0];
  steeringElement = document.getElementById('steering');
  svgNameSpace = spaceRootElement.getAttribute('xmlns');
  // create master knyte
  const masterKnyteId = knit.new();
  masterKnoxelId = knit.new();
  const masterColor = visualThemeColors.masterFill;
  addKnyte({knyteId: masterKnyteId, color: masterColor});
  // create spacemap knyte
  const spacemapKnyteId = knit.new();
  spacemapKnoxelId = knit.new();
  const spacemapColor = visualTheme.navigation.fillColor;
  addKnyte({knyteId: spacemapKnyteId, color: spacemapColor});
  // create master and spacemap knoxels
  const position = {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight};
  addKnoxel({hostKnyteId: spacemapKnyteId, knyteId: masterKnyteId, knoxelId: masterKnoxelId, position});
  addKnoxel({hostKnyteId: spacemapKnyteId, knyteId: spacemapKnyteId, knoxelId: spacemapKnoxelId, position});
  // setup event handlers
  spaceRootElement.addEventListener('click', onClickSpaceRoot, false);
  spaceRootElement.addEventListener('mousemove', onMouseMoveSpaceRoot, false);
  window.addEventListener('resize', onResizeWindow, false);
  window.addEventListener('keydown', onKeyDownWindow, false);
  window.addEventListener('keyup', onKeyUpWindow, false);
  window.addEventListener('mousewheel', onMouseWheelWindow, {passive: false});
  document.getElementById('backArrowShape').addEventListener('click', onClickSpaceBack, false);
  document.getElementById('forwardArrowShape').addEventListener('click', onClickSpaceForward, false);
  document.getElementById('spaceMapButton').addEventListener('click', onClickSpaceMap, false);
  // setup space root view
  setSpaceRootKnoxel({knoxelId: masterKnoxelId});
  setNavigationControlState({});
  onResizeWindow();
  // initialise spacemap
  handleSpacemapChanged = spacemapChangedHandler;
  handleSpacemapChanged();
  // initialise steering
  handleSteeringChanged = steeringChangedHandler;
  // init appstate on startup
  const {fileSHA} = await fetchRepoStatus();
  if (fileSHA)
    await loadAppState({fileSHA});
  bootLoadingElement.style.display = 'none';

  console.log('ready');
}