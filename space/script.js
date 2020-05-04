/* global visualThemeColors */
/* global intersect */

let svgNameSpace;
let spaceRootElement;
let spaceBackElement;
let spaceForwardElement;
let spaceMapElement;
let spaceHostElement;
let spacemapKnoxelId;
let handleSpacemapChanged = function() {};
const knytesCloud = {}; // core knyte id --> {initialKnyteId, terminalKnyteId}
const knoxelVectors = {}; // knoxel id --> {initialKnoxelId, terminalKnoxelId}
const informationMap = {}; // knyte id --> {color, space: {knoxel id --> position}, record: {data, viewer}, size}
const knoxels = {}; // knoxel id --> knyte id
const arrows = {}; // arrow id --> {initialKnoxelId, terminalKnoxelId}
const spaceBackStack = []; // [previous space root knoxel id]
const spaceForwardStack = []; // [next space root knoxel id]
const visualTheme = {
  rect: {
    strokeColor: visualThemeColors.outline,
    strokeWidth: 4,
    selfcontained: {
      dashLength: 8
    },
    recursive: {
      strokeWidth: 2
    },
    pictograph: {
      strokeWidth: 2
    },
    fillColor: visualThemeColors.fill,
    defaultWidth: 32,
    defaultHeight: 32,
  },
  arrow: {
    strokeColor: visualThemeColors.line,
    strokeWidth: 3,
    recursive: {
      strokeWidth: 2
    },
    defaultLength: 12,
    defaultWidth: 10,
    defaultHeight: 10,
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

function addKnyte(desc)
{
  // desc: {knyteId, initialKnyteId, terminalKnyteId, color}
  knytesCloud[desc.knyteId] = {
    initialKnyteId: desc.initialKnyteId,
    terminalKnyteId: desc.terminalKnyteId
  };
  informationMap[desc.knyteId] = {color: desc.color, space: {}};
}

function addKnoxel(desc)
{
  // desc: {hostKnyteId, knyteId, knoxelId, position}
  knoxels[desc.knoxelId] = desc.knyteId;
  if (desc.hostKnyteId)
    informationMap[desc.hostKnyteId].space[desc.knoxelId] = desc.position;
}

const knoxelRect = new function()
{
  function computeArrowShape(w, h, x, y, knoxelId, hostKnyteId, arrowStrokeWidth)
  {
    const hostSpace = informationMap[hostKnyteId].space;
    const endpoints = knoxelVectors[knoxelId];
    const l = visualTheme.arrow.defaultLength;
    const {x1, y1, x2, y2, x3, y3, initialCross, terminalCross} = endpoints
      ? getArrowPointsByKnoxels({arrowSpace: hostSpace, jointKnoxelId: knoxelId,
        initialKnoxelId: endpoints.initialKnoxelId, terminalKnoxelId: endpoints.terminalKnoxelId, w, h, arrowStrokeWidth})
      : {x1: (w - l)/2, y1: h/2, x2: w/2, y2: h/2, x3: (w + l)/2, y3: h/2, initialCross: false, terminalCross: false};
    return {x1, y1, x2, y2, x3, y3, initialCross, terminalCross};
  }
  
  function getFigureDimensions(knoxelId, knyteTrace)
  {
    const isArrow = (knoxelId in knoxelVectors) &&
      (knoxelVectors[knoxelId].initialKnoxelId || knoxelVectors[knoxelId].terminalKnoxelId);
    let w = isArrow ? visualTheme.arrow.defaultWidth : visualTheme.rect.defaultWidth;
    let h = isArrow ? visualTheme.arrow.defaultHeight : visualTheme.rect.defaultHeight;
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
    if (type === 'recursive')
    {
      const {size, space} = informationMap[knyteId];
      if (size)
      {
        w = Math.max(w, size.w);
        h = Math.max(h, size.h);
      }
      let left = 1000000, right = -1000000, top = 1000000, bottom = -1000000;
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
        const d = getFigureDimensions(nestedKnoxelId, nestedKnyteTrace);
        const nestedW = d.w;
        const nestedH = d.h;
        const {x, y} = space[nestedKnoxelId];
        const {color, record} = informationMap[nestedKnyteId];
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
          nestedKnoxelId, knyteId, visualTheme.arrow.recursive.strokeWidth);
        const r = {rectId, x: nestedX, y: nestedY, w: nestedW, h: nestedH, color, record, 
          x1, y1, x2, y2, x3, y3, initialCross, terminalCross, type: nestedType};
        rects.push(r);
        if (d.type === 'recursive')
        {
          for (let i = 0; i < d.rects.length; ++i)
          {
            const rr = d.rects[i];
            rects.push({rectId: rr.rectId, x: r.x + rr.x, y: r.y + rr.y, w: rr.w, h: rr.h, 
              color: rr.color, record: rr.record, x1: rr.x1, y1: rr.y1, x2: rr.x2, y2: rr.y2, x3: rr.x3, y3: rr.y3, type: rr.type});
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
      const r = {x: 0, y: 0, w, h, color, record, type};
      rects.push(r);
    }
    return {w, h, leftTop, rects, arrows, type};
  }

  this.add = function(desc)
  {
    // desc: {knoxelId, position, ghost, bubble, selfcontained}
    
    function createRectShape(desc)
    {
      // desc: {w, h, color, strokeWidth}
      const rect = document.createElementNS(svgNameSpace, 'rect');
      rect.setAttribute('width', desc.w);
      rect.setAttribute('height', desc.h);
      rect.setAttribute('fill', desc.color);
      rect.setAttribute('stroke', visualTheme.rect.strokeColor);
      rect.setAttribute('stroke-width', desc.strokeWidth);
      return rect;
    }
    
    function createForeignObject(desc)
    {
      // desc: {w, h, strokeWidth, record}
      const info = document.createElementNS(svgNameSpace, 'foreignObject');
      info.setAttribute('x', desc.strokeWidth/2);
      info.setAttribute('y', desc.strokeWidth/2);
      info.setAttribute('width', desc.w - desc.strokeWidth);
      info.setAttribute('height', desc.h - desc.strokeWidth);
      info.innerHTML = desc.record.viewer(desc.record.data);
      return info;
    }
    
    function createArrowShape(desc)
    {
      // desc: {x1, y1, x2, y2, x3, y3, initialCross, terminalCross, strokeWidth}
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
      arrow.setAttribute('stroke', visualTheme.arrow.strokeColor);
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
            initialCross: r.initialCross, terminalCross: r.terminalCross, strokeWidth: visualTheme.arrow.recursive.strokeWidth});
          if (r.rectId) arrow.id = r.rectId + '.arrow';
          rectGroup.appendChild(arrow); // TODO: hide arrow if useless for visualisation
          const rect = createRectShape({w: r.w, h: r.h, color: r.color, strokeWidth: visualTheme.rect.recursive.strokeWidth});
          if (r.rectId) rect.id = r.rectId + '.rect';
          rectGroup.appendChild(rect);
          if (r.type === 'recursive' && r.record)
          {
            const info = createForeignObject(
              {w: r.w, h: r.h, strokeWidth: visualTheme.rect.recursive.strokeWidth, record: r.record}
            );
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
        result.push(rectGroup);
      }
      return result;
    }
    
    function updateArrowShapes(arrows)
    {
      for (let id in arrows)
      {
        const arrowId = id + '.arrow';
        const rectId = id + '.rect';
        const initialRectId = arrows[id].initialRectId + '.rect';
        const terminalRectId = arrows[id].terminalRectId + '.rect';
        const {space, knoxelId, initialKnoxelId, terminalKnoxelId} = arrows[id];
        const arrowStrokeWidth = visualTheme.arrow.recursive.strokeWidth;
        const {x1, y1, x2, y2, x3, y3} = getArrowPointsByRects({arrowSpace: space, jointKnoxelId: knoxelId,
          initialKnoxelId, terminalKnoxelId, rectId, initialRectId, terminalRectId, arrowStrokeWidth});
        const arrowShape = document.getElementById(arrowId);
        arrowShape.points.getItem(0).x = x1;
        arrowShape.points.getItem(0).y = y1;
        arrowShape.points.getItem(1).x = x2;
        arrowShape.points.getItem(1).y = y2;
        arrowShape.points.getItem(2).x = x3;
        arrowShape.points.getItem(2).y = y3;
      }
    }
    
    function createFigure(desc)
    {
      const knyteId = knoxels[desc.knoxelId];
      const {color, record} = informationMap[knyteId];
      const knyteTrace = {};
      const hostKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
      knyteTrace[hostKnyteId] = true;
      const {w, h, rects, arrows, type} = getFigureDimensions(desc.knoxelId, knyteTrace);
      const x = desc.position.x - w/2;
      const y = desc.position.y - h/2;
      const rectGroup = document.createElementNS(svgNameSpace, 'g');
      rectGroup.id = desc.knoxelId;
      rectGroup.classList.value = 'mouseOverRect';
      rectGroup.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      if (!desc.ghost && !desc.bubble)
      {
        const {x1, y1, x2, y2, x3, y3, initialCross, terminalCross} = computeArrowShape(
          w, h, x, y, desc.knoxelId, hostKnyteId, visualTheme.arrow.strokeWidth);
        const arrowRoot = createArrowShape({x1, y1, x2, y2, x3, y3, initialCross, terminalCross, 
          strokeWidth: visualTheme.arrow.strokeWidth});
        arrowRoot.id = desc.knoxelId + '.arrow';
        rectGroup.appendChild(arrowRoot); // TODO: hide arrow if useless for visualisation
      }
      const rectRoot = createRectShape({w, h, color, strokeWidth: visualTheme.rect.strokeWidth});
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
        selfcontainedLine1.setAttribute('stroke', visualTheme.rect.strokeColor);
        selfcontainedLine1.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        const selfcontainedLine2 = document.createElementNS(svgNameSpace, 'line');
        selfcontainedLine2.setAttribute('x1', w);
        selfcontainedLine2.setAttribute('y1', h);
        selfcontainedLine2.setAttribute('x2', (d+dirLength)*dir.x);
        selfcontainedLine2.setAttribute('y2', (d+dirLength)*dir.y);
        selfcontainedLine2.setAttribute('stroke', visualTheme.rect.strokeColor);
        selfcontainedLine2.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        const selfcontainedLine3 = document.createElementNS(svgNameSpace, 'line');
        selfcontainedLine3.setAttribute('x1', -d*dir.x);
        selfcontainedLine3.setAttribute('y1', (d+dirLength)*dir.y);
        selfcontainedLine3.setAttribute('x2', 0);
        selfcontainedLine3.setAttribute('y2', h);
        selfcontainedLine3.setAttribute('stroke', visualTheme.rect.strokeColor);
        selfcontainedLine3.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        const selfcontainedLine4 = document.createElementNS(svgNameSpace, 'line');
        selfcontainedLine4.setAttribute('x1', w);
        selfcontainedLine4.setAttribute('y1', 0);
        selfcontainedLine4.setAttribute('x2', (d+dirLength)*dir.x);
        selfcontainedLine4.setAttribute('y2', -d*dir.y);
        selfcontainedLine4.setAttribute('stroke', visualTheme.rect.strokeColor);
        selfcontainedLine4.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
        rectGroup.appendChild(selfcontainedLine1);
        rectGroup.appendChild(selfcontainedLine2);
        rectGroup.appendChild(selfcontainedLine3);
        rectGroup.appendChild(selfcontainedLine4);
      }
      if (record && type === 'recursive')
      {
        const info = createForeignObject(
          {w, h, strokeWidth: visualTheme.rect.strokeWidth, record}
        );
        rectGroup.appendChild(info);
      }
      const shapes = createShapes(rects, arrows, type);
      for (let i = 0; i < shapes.length; ++i)
        rectGroup.appendChild(shapes[i]);
      //updateArrowShapes(arrows);
      setTimeout(updateArrowShapes, 0, arrows);
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
  
  this.updateArrowShape = function(knoxelId, position)
  {
    const arrowShape = document.getElementById(knoxelId + '.arrow');
    const knyteId = knoxels[knoxelId];
    const knyteTrace = {};
    const hostKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
    knyteTrace[hostKnyteId] = true;
    const {w, h} = getFigureDimensions(knoxelId, knyteTrace);
    const x = position.x - w/2;
    const y = position.y - h/2;
    const {x1, y1, x2, y2, x3, y3} = computeArrowShape(
      w, h, x, y, knoxelId, hostKnyteId, visualTheme.arrow.strokeWidth);
    arrowShape.points.getItem(0).x = x1;
    arrowShape.points.getItem(0).y = y1;
    arrowShape.points.getItem(1).x = x2;
    arrowShape.points.getItem(1).y = y2;
    arrowShape.points.getItem(2).x = x3;
    arrowShape.points.getItem(2).y = y3;
  }
  
  this.getSize = function(knoxelId)
  {
    const {w, h, leftTop} = getFigureDimensions(knoxelId, {});
    return {w, h, leftTop};
  };
  
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
  
  this.getElementSize = function(element)
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
    const {width, height} = rectShape.getBoundingClientRect();
    return {w: width, h: height};
  };
  
  this.moveElement = function(desc)
  {
    // desc: {element, x, y}
    const {w, h} = this.getElementSize(desc.element);
    const x = desc.x - w/2;
    const y = desc.y - h/2;
    if (desc.element.tagName === 'g')
      desc.element.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    else
      console.error('failed moving for knoxelId ' + desc.element.id);
  };
  
  this.getRootByTarget = function(targetElement)
  {
    let element = targetElement;
    while (element.classList.value !== 'mouseOverRect' && element !== spaceRootElement)
      element = element.parentElement;
    return element;
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
    foreignObject.innerHTML = record ? record.viewer(record.data) : '';
    const {w, h, leftTop} = knoxelRect.getSize(knoxelId);
    const strokeW = visualTheme.rect.strokeWidth;
    foreignObject.setAttribute('x', leftTop.x + strokeW/2);
    foreignObject.setAttribute('y', leftTop.y + strokeW/2);
    foreignObject.setAttribute('width', w - strokeW);
    foreignObject.setAttribute('height', h - strokeW);
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
      console.error('failed dotting for knoxelId ' + desc.knoxelId);
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
  this.centeredOneliner = function(data)
  {
    return '<div style="display: flex; height: 100%; justify-content: center; align-items: center;">' +
      data + '</div>';
  };
  this.strightCode = function(data)
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

function setSpaceRootKnoxel(desc)
{
  // desc: {knoxelId}
  const priorKnoxelId = spaceRootElement.dataset.knoxelId;
  const newKnoxelId = desc.knoxelId;
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
  setBubbledMode({knoxelId: activeBubble.knoxelId, knyteId: knoxels[activeBubble.knoxelId], isBubbled: true});
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
  // desc: {arrowSpace, jointKnoxelId, initialKnoxelId, terminalKnoxelId, rectId, initialRectId, terminalRectId, arrowStrokeWidth}

  function getBoundingClientDimension(element)
  {
    const {width, height} = element.getBoundingClientRect();
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
      const initialTime = collideAABBVsLine(
        {position: initialPosition, dimension: initialDimension},
        {position1: jointPosition, position2: initialPosition}
      );
      const rectStrokeOffset = 0.5*visualTheme.rect.strokeWidth;
      const initialArrowStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const arrowIntervalStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const initialStrokeOffset = rectStrokeOffset + initialArrowStrokeOffset + arrowIntervalStrokeOffset;
      x1 -= ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.x;
      y1 -= ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.y;
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
      const terminalTime = collideAABBVsLine(
        {position: terminalPosition, dimension: terminalDimension},
        {position1: jointPosition, position2: terminalPosition}
      );
      const rectStrokeOffset = 0.5*visualTheme.rect.strokeWidth;
      const terminalArrowStrokeOffset = 2.0*desc.arrowStrokeWidth;
      const arrowIntervalStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const terminalStrokeOffset = rectStrokeOffset + terminalArrowStrokeOffset + arrowIntervalStrokeOffset;
      x3 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.x;
      y3 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.y;
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
  // desc: {arrowSpace, jointKnoxelId, initialKnoxelId, terminalKnoxelId, w, h, arrowStrokeWidth}
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
      const initialDimension = initialElement ? knoxelRect.getElementSize(initialElement) : {w, h};
      const initialTime = collideAABBVsLine(
        {position: initialPosition, dimension: initialDimension},
        {position1: jointPosition, position2: initialPosition}
      );
      const rectStrokeOffset = 0.5*visualTheme.rect.strokeWidth;
      const initialArrowStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const arrowIntervalStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const initialStrokeOffset = rectStrokeOffset + initialArrowStrokeOffset + arrowIntervalStrokeOffset;
      x1 -= ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.x;
      y1 -= ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.y;
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
      const terminalDimension = terminalElement ? knoxelRect.getElementSize(terminalElement) : {w, h};
      const terminalTime = collideAABBVsLine(
        {position: terminalPosition, dimension: terminalDimension},
        {position1: jointPosition, position2: terminalPosition}
      );
      const rectStrokeOffset = 0.5*visualTheme.rect.strokeWidth;
      const terminalArrowStrokeOffset = 2.0*desc.arrowStrokeWidth;
      const arrowIntervalStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const terminalStrokeOffset = rectStrokeOffset + terminalArrowStrokeOffset + arrowIntervalStrokeOffset;
      x3 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.x;
      y3 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.y;
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
      const initialDimension = initialElement ? knoxelRect.getElementSize(initialElement) : {w, h};
      const initialTime = collideAABBVsLine(
        {position: initialPosition, dimension: initialDimension},
        {position1: terminalPosition, position2: initialPosition}
      );
      const terminalElement = document.getElementById(desc.terminalKnoxelId);
      const terminalDimension = terminalElement ? knoxelRect.getElementSize(terminalElement) : {w, h};
      const terminalTime = collideAABBVsLine(
        {position: terminalPosition, dimension: terminalDimension},
        {position1: initialPosition, position2: terminalPosition}
      );
      const rectStrokeOffset = 0.5*visualTheme.rect.strokeWidth;
      const initialArrowStrokeOffset = 0.5*desc.arrowStrokeWidth;
      const terminalArrowStrokeOffset = 2.0*desc.arrowStrokeWidth;
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
  arrow.setAttribute('stroke', visualTheme.arrow.strokeColor);
  arrow.setAttribute('stroke-width', visualTheme.arrow.strokeWidth);
  arrow.setAttribute('marker-start', 'url(#arrowTail)');
  arrow.setAttribute('marker-end', 'url(#arrowHead)');
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
  // desc: {knyteId, hostKnoxelId, position}
  const position = activeGhost.knoxelId
    ? {x: desc.position.x + activeGhost.offset.x, y: desc.position.y + activeGhost.offset.y}
    : desc.position;
  const hostKnyteId = knoxels[desc.hostKnoxelId];
  const knoxelId = knit.new();
  addKnoxel({hostKnyteId, knyteId: desc.knyteId, knoxelId, position});
  knoxelRect.add({knoxelId, position});
  knoxelRect.updateArrowShape(knoxelId, position);
}

function onClickRect(e)
{
  const targetKnoxelElement = knoxelRect.getRootByTarget(e.target);
  if (!e.shiftKey && !e.altKey && !e.metaKey)
  {
    if (targetKnoxelElement.id !== spaceRootElement.dataset.knoxelId)
    {
      spaceBackStack.push(spaceRootElement.dataset.knoxelId);
      spaceForwardStack.length = 0;
      setSpaceRootKnoxel({knoxelId: targetKnoxelElement.id});
      refreshActiveRect({position: mouseMovePosition});
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
  addKnoxelRect({knyteId, hostKnoxelId: desc.hostKnoxelId, position: desc.position});
}

function joinKnoxels(desc)
{
  // desc: {removeKnoxelId, stayKnoxelId}
  replaceKnoxelInStacks(desc);
  removeKnoxel({knoxelId: desc.removeKnoxelId});
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

function onClickSpaceRoot(e)
{
  const mousePosition = {x: e.clientX, y: e.clientY};
  const mousePagePosition = {x: e.pageX, y: e.pageY};
  if (!e.shiftKey && !e.altKey && e.metaKey)
  {
    const knyteId = knit.new();
    const color = visualTheme.rect.fillColor;
    addKnyte({knyteId, initialKnyteId: knit.empty, terminalKnyteId: knit.empty, color});
    addKnoxelRect({knyteId, hostKnoxelId: spaceRootElement.dataset.knoxelId, position: mousePosition});
    knoxelSpaceRoot.update();
    handleSpacemapChanged();
  }
}

function onClickSpaceMap(e)
{
  if (spaceRootElement.dataset.knoxelId === spacemapKnoxelId)
    return;
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  spaceForwardStack.length = 0;
  setSpaceRootKnoxel({knoxelId: spacemapKnoxelId});
  refreshActiveRect({position: mouseMovePosition});
  setNavigationControlState({
    backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
  });
}

function onClickSpaceHost(e)
{
  if (!activeGhost.spawnSpaceRootKnoxelId)
    return;
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  spaceForwardStack.length = 0;
  setSpaceRootKnoxel({knoxelId: activeGhost.spawnSpaceRootKnoxelId});
  refreshActiveRect({position: mouseMovePosition});
  setNavigationControlState({
    backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
  });
}

function onClickSpaceBack(e)
{
  spaceForwardStack.push(spaceRootElement.dataset.knoxelId);
  const backKnoxelId = spaceBackStack.pop();
  if (backKnoxelId)
  {
    setSpaceRootKnoxel({knoxelId: backKnoxelId});
    refreshActiveRect({position: mouseMovePosition});
    setNavigationControlState({
      backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
      forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
    });
  }
}

function onClickSpaceForward(e)
{
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  const forwardKnoxelId = spaceForwardStack.pop();
  if (forwardKnoxelId)
  {
    setSpaceRootKnoxel({knoxelId: forwardKnoxelId});
    refreshActiveRect({position: mouseMovePosition});
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
  {
    spaceBackElement.style.display = 'none';
  }
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
  {
    spaceForwardElement.style.display = 'none';
  }
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
    mapShape.setAttribute('fill', visualTheme.navigation.fillColor);
    spaceMapElement.style.display = 'block';
  }
  else
  {
    spaceMapElement.style.display = 'none';
  }
  if (
    activeGhost.knoxelId &&
    activeGhost.spawnSpaceRootKnoxelId !== spaceRootElement.dataset.knoxelId
  )
  {
    const hostShape = document.getElementById('hostShape');
    hostShape.setAttribute('stroke', visualTheme.navigation.strokeColor);
    hostShape.setAttribute('fill', visualTheme.navigation.fillColor);
    spaceHostElement.style.display = 'block';
  }
  else
  {
    spaceHostElement.style.display = 'none';
  }
}

function createActiveRect(desc)
{
  // desc: {knoxelId, position, ghost, bubble}
  const id = knoxelRect.add(desc);
  return document.getElementById(id);
}

function refreshActiveRect(desc)
{
  // desc: {position}
  if (activeGhost.knoxelId)
  {
    activeGhost.element.remove();
    activeGhost.element = createActiveRect({knoxelId: activeGhost.knoxelId, position: desc.position, ghost: true});
    activeGhost.offset = {x: 0, y: 0};
  }
  if (activeBubble.knoxelId)
  {
    activeBubble.element.remove();
    activeBubble.element = createActiveRect({knoxelId: activeBubble.knoxelId, position: desc.position, bubble: true});
    activeBubble.offset = {x: 0, y: 0};
  }
  if (activeInitialGhost.knoxelId)
  {
    activeInitialGhost.element.remove();
    activeInitialGhost.element = createActiveArrow(
      {knoxelId: activeInitialGhost.knoxelId, position: desc.position, initial: true});
  }
  if (activeTerminalGhost.knoxelId)
  {
    activeTerminalGhost.element.remove();
    activeTerminalGhost.element = createActiveArrow(
      {knoxelId: activeTerminalGhost.knoxelId, position: desc.position, terminal: true});
  }
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
  activeGhost.element = createActiveRect({knoxelId: desc.knoxelId, position: desc.position, ghost: true});
  if (desc.selfcontained)
  {
    activeGhost.offset = {x: 0, y: 0};
    if (desc.knoxelId in spawnSpaceRootKnoxelSpace)
      setGhostedMode({knoxelId: desc.knoxelId, isGhosted: true});
  }
  else
  {
    const knoxelPosition = spawnSpaceRootKnoxelSpace[desc.knoxelId];
    const ox = knoxelPosition.x - desc.position.x;
    const oy = knoxelPosition.y - desc.position.y;
    activeGhost.offset = {x: ox, y: oy};
    const x = mouseMovePosition.x + activeGhost.offset.x;
    const y = mouseMovePosition.y + activeGhost.offset.y;
    knoxelRect.moveElement({element: activeGhost.element, x, y});
    setGhostedMode({knoxelId: desc.knoxelId, isGhosted: true});
  }
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
  activeBubble.element = createActiveRect({knoxelId: desc.knoxelId, position: desc.position, bubble: true});
  if (desc.selfcontained)
  {
    activeBubble.offset = {x: 0, y: 0};
  }
  else
  {
    const hostKnyteId = getHostKnyteIdByKnoxelId(desc.knoxelId);
    const hostKnoxelSpace = informationMap[hostKnyteId].space;
    const knoxelPosition = hostKnoxelSpace[desc.knoxelId];
    const ox = knoxelPosition.x - desc.position.x;
    const oy = knoxelPosition.y - desc.position.y;
    activeBubble.offset = {x: ox, y: oy};
    const x = mouseMovePosition.x + activeBubble.offset.x;
    const y = mouseMovePosition.y + activeBubble.offset.y;
    knoxelRect.moveElement({element: activeBubble.element, x, y});
  }
  setBubbledMode({knoxelId: desc.knoxelId, knyteId, isBubbled: true});
}

function terminateBubbleRect()
{
  activeBubble.element.remove();
  setBubbledMode({knoxelId: activeBubble.knoxelId, knyteId: knoxels[activeBubble.knoxelId], isBubbled: false});
  activeBubble.knoxelId = null;
  activeBubble.offset = {x: 0, y: 0};
  activeBubble.element = null;
}

function createActiveArrow(desc)
{
  // desc: {knoxelId, position, initial, terminal}
  const arrow = document.createElementNS(svgNameSpace, 'line');
  const spaceRootKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
  const spacePosition = informationMap[spaceRootKnyteId].space[desc.knoxelId];
  let cross = false;
  let originPosition;
  if (!spacePosition)
  {
    originPosition = {x: desc.position.x + visualTheme.arrow.defaultLength, y: desc.position.y};
    cross = true;
  }
  else
    originPosition = spacePosition;
  arrow.style.pointerEvents = 'none';
  arrow.setAttribute('x1', originPosition.x);
  arrow.setAttribute('y1', originPosition.y);
  arrow.setAttribute('x2', desc.position.x);
  arrow.setAttribute('y2', desc.position.y);
  arrow.setAttribute('fill', 'none');
  arrow.setAttribute('stroke', visualTheme.arrow.strokeColor);
  arrow.setAttribute('stroke-width', visualTheme.arrow.strokeWidth);
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
  activeInitialGhost.element = createActiveArrow({knoxelId: desc.knoxelId, position: desc.position, initial: true});
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
  activeTerminalGhost.element = createActiveArrow({knoxelId: desc.knoxelId, position: desc.position, terminal: true});
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

function onMouseDownSpaceRoot(e)
{
}

let mouseMovePosition = {x: 0, y: 0};
let mouseMovePagePosition = {x: 0, y: 0};

function onMouseMoveSpaceRoot(e)
{
  mouseMovePosition = {x: e.clientX, y: e.clientY};
  mouseMovePagePosition = {x: e.pageX, y: e.pageY};
  if (activeGhost.knoxelId)
  {
    const x = mouseMovePosition.x + activeGhost.offset.x;
    const y = mouseMovePosition.y + activeGhost.offset.y;
    knoxelRect.moveElement({element: activeGhost.element, x, y});
  }
  if (activeBubble.knoxelId)
  {
    const x = mouseMovePosition.x + activeBubble.offset.x;
    const y = mouseMovePosition.y + activeBubble.offset.y;
    knoxelRect.moveElement({element: activeBubble.element, x, y});
  }
  if (activeInitialGhost.knoxelId)
  {
    const {x, y} = mouseMovePosition;
    knoxelArrow.moveElement({knoxelId: activeInitialGhost.knoxelId, element: activeInitialGhost.element, x, y});
  }
  if (activeTerminalGhost.knoxelId)
  {
    const {x, y} = mouseMovePosition;
    knoxelArrow.moveElement({knoxelId: activeTerminalGhost.knoxelId, element: activeTerminalGhost.element, x, y});
  }
}

function onMouseUpSpaceRoot(e)
{
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
  if (!(desc.droppedKnoxelId in knoxelVectors))
    knoxelVectors[desc.droppedKnoxelId] = {};
  if (desc.connectingKnoxelId)
    knoxelVectors[desc.droppedKnoxelId].initialKnoxelId = desc.connectingKnoxelId;
  else
    delete knoxelVectors[desc.droppedKnoxelId].initialKnoxelId;
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
  handleSpacemapChanged();
}

function terminalConnectGhostRect(desc)
{
  // desc: {droppedKnoxelId, connectingKnoxelId}
  if (!(desc.droppedKnoxelId in knoxelVectors))
    knoxelVectors[desc.droppedKnoxelId] = {};
  if (desc.connectingKnoxelId)
    knoxelVectors[desc.droppedKnoxelId].terminalKnoxelId = desc.connectingKnoxelId;
  else
    delete knoxelVectors[desc.droppedKnoxelId].terminalKnoxelId;
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
  handleSpacemapChanged();
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
}

function joinActiveBubble(desc)
{
  // desc: {joinedKnoxelId}
  const stayKnoxelId = activeBubble.knoxelId;
  joinKnoxels({removeKnoxelId: desc.joinedKnoxelId, stayKnoxelId});
  handleSpacemapChanged();
  setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
}

function getSizeOfRecord(record)
{
  const autosizer = document.getElementById('autosizer');
  autosizer.innerHTML = record.viewer(record.data);
  const rect = autosizer.getBoundingClientRect();
  autosizer.innerHTML = '';
  const strokeW = visualTheme.rect.strokeWidth;
  const w = rect.width + 3*strokeW, h = rect.height + strokeW;
  return {w, h};
}

function onKeyDownWindow(e)
{
  if (document.getElementById('colorpicker').open)
    return;
  const mouseoverTarget = document.elementFromPoint(mouseMovePagePosition.x, mouseMovePagePosition.y);
  const mouseoverElement = knoxelRect.getRootByTarget(mouseoverTarget);
  const mouseoverKnoxelId = mouseoverElement.classList.value === 'mouseOverRect'
    ? mouseoverElement.id : null;
  if (e.code === 'Escape')
  {
    if (activeGhost.knoxelId)
      terminateGhostRect();
    if (activeBubble.knoxelId)
      terminateBubbleRect();
    if (activeInitialGhost.knoxelId)
      terminateInitialGhostArrow();
    if (activeTerminalGhost.knoxelId)
      terminateTerminalGhostArrow();
    setNavigationControlState({
      backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
      forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
    });
  }
  else if (e.code === 'Space' && !activeBubble.knoxelId && !activeInitialGhost.knoxelId && !activeTerminalGhost.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const position = mouseMovePosition;
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
  else if (e.code === 'KeyB' && !activeGhost.knoxelId && !activeInitialGhost.knoxelId && !activeTerminalGhost.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const position = mouseMovePosition;
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
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      const {record, size} = informationMap[knyteId];
      const newData = prompt('Edit knyte value', record ? record.data : '');
      if (newData !== null)
      {
        const newRecord = {data: newData, viewer: recordViewers.centeredOneliner};
        const size = getSizeOfRecord(newRecord);
        informationMap[knyteId].record = newRecord;
        informationMap[knyteId].size = size;
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
    }
  }
  else if (e.code === 'KeyS')
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      const {size} = informationMap[knyteId];
      const newSize = prompt('Edit knyte size', size ? JSON.stringify(size) : '{"w": 0, "h": 0}');
      if (newSize)
      {
        informationMap[knyteId].size = JSON.parse(newSize);
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
    }
  }
  else if (e.code === 'KeyC')
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      function onCloseDialog(e)
      {
        e.target.removeEventListener('close', onCloseDialog);
        const newColor = e.target.returnValue;
        if (newColor)
        {
          informationMap[knyteId].color = newColor;
          setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
          handleSpacemapChanged();
        }
      }
      
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      const {color} = informationMap[knyteId];
      const colorpickerDialog = document.getElementById('colorpicker');
      const colorpickerInput = colorpickerDialog.getElementsByTagName('input')[0];
      colorpickerInput.value = color;
      colorpickerDialog.returnValue = '';
      colorpickerDialog.dataset.knyteId = knyteId;
      colorpickerDialog.addEventListener('close', onCloseDialog);
      setTimeout(function(){colorpickerDialog.showModal();}, 0);
    }
  }
  else if (e.code === 'KeyO')
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      prompt('Knoxel id:', knoxelId);
    }
  }
  else if (e.code === 'KeyY')
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
      const knyteId = knoxels[knoxelId];
      prompt('Knyte id:', knyteId);
    }
  }
  else if (e.code === 'KeyZ' && !activeTerminalGhost.knoxelId && !activeGhost.knoxelId && !activeBubble.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const position = mouseMovePosition;
      if (!activeInitialGhost.knoxelId)
      {
        if (mouseoverKnoxelId)
        {
          let knoxelId = mouseoverKnoxelId;
          const spawnSpaceRootKnoxelId = spaceRootElement.dataset.knoxelId;
          spawnInitialGhostArrow({knoxelId, spawnSpaceRootKnoxelId, position});
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
  else if (e.code === 'KeyX' && !activeInitialGhost.knoxelId && !activeGhost.knoxelId && !activeBubble.knoxelId)
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const position = mouseMovePosition;
      if (!activeTerminalGhost.knoxelId)
      {
        if (mouseoverKnoxelId)
        {
          let knoxelId = mouseoverKnoxelId;
          const spawnSpaceRootKnoxelId = spaceRootElement.dataset.knoxelId;
          spawnTerminalGhostArrow({knoxelId, spawnSpaceRootKnoxelId, position});
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
}

function spacemapChangedHandler()
{
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
  for (let knyteId in knytesCloud)
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

function onLoadBody(e)
{
  // init space root element
  spaceRootElement = document.getElementsByClassName('spaceRoot')[0];
  spaceBackElement = document.getElementsByClassName('spaceBack')[0];
  spaceForwardElement = document.getElementsByClassName('spaceForward')[0];
  spaceMapElement = document.getElementsByClassName('spaceMap')[0];
  spaceHostElement = document.getElementsByClassName('spaceHost')[0];
  svgNameSpace = spaceRootElement.getAttribute('xmlns');
  // create master knyte
  const masterKnyteId = knit.new();
  const masterKnoxelId = knit.new();
  const masterColor = visualTheme.rect.fillColor;
  addKnyte({knyteId: masterKnyteId, initialKnyteId: knit.empty, terminalKnyteId: knit.empty, color: masterColor});
  // create spacemap knyte
  const spacemapKnyteId = knit.new();
  spacemapKnoxelId = knit.new();
  const spacemapColor = visualTheme.navigation.fillColor;
  addKnyte({knyteId: spacemapKnyteId, initialKnyteId: knit.empty, terminalKnyteId: knit.empty, color: spacemapColor});
  // create master and spacemap knoxels
  const position = {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight};
  addKnoxel({hostKnyteId: spacemapKnyteId, knyteId: masterKnyteId, knoxelId: masterKnoxelId, position});
  addKnoxel({hostKnyteId: masterKnyteId, knyteId: spacemapKnyteId, knoxelId: spacemapKnoxelId, position});
  // setup event handlers
  spaceRootElement.addEventListener('click', onClickSpaceRoot, false);
  spaceRootElement.addEventListener('mousedown', onMouseDownSpaceRoot, false);
  spaceRootElement.addEventListener('mousemove', onMouseMoveSpaceRoot, false);
  spaceRootElement.addEventListener('mouseup', onMouseUpSpaceRoot, false);
  window.addEventListener('resize', onResizeWindow, false);
  window.addEventListener('keydown', onKeyDownWindow, false);
  document.getElementById('backArrowShape').addEventListener('click', onClickSpaceBack, false);
  document.getElementById('forwardArrowShape').addEventListener('click', onClickSpaceForward, false);
  document.getElementById('spaceMapButton').addEventListener('click', onClickSpaceMap, false);
  document.getElementById('spaceHostButton').addEventListener('click', onClickSpaceHost, false);
  // setup space root view
  setSpaceRootKnoxel({knoxelId: masterKnoxelId});
  setNavigationControlState({});
  onResizeWindow();
  // initialise spacemap
  handleSpacemapChanged = spacemapChangedHandler;
  handleSpacemapChanged();
  
  console.log('ready');
}