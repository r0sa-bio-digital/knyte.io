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
    fillColor: {
      getRandom: function() {
        const colors = visualThemeColors.elements;
        const randomIndex = Math.floor(Math.random() * colors.length);
        return colors[randomIndex];
      }
    },
    defaultWidth: 32,
    defaultHeight: 32,
  },
  arrow: {
    strokeColor: visualThemeColors.line,
    strokeWidth: 3,
  },
  navigation: {
    strokeColor: visualThemeColors.control,
    fillColor: visualThemeColors.navigation,
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
  if (true) // debug content // TODO: remove after basic system implementation
  {
    const record = {data: 'My Text', viewer: recordViewers.centeredOneliner};
    const size = getSizeOfRecord(record);
    informationMap[desc.knyteId].record = record;
    informationMap[desc.knyteId].size = size;
  }
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
  function getFigureDimensions(knoxelId, knyteTrace)
  {
    let w = visualTheme.rect.defaultWidth;
    let h = visualTheme.rect.defaultHeight;
    const leftTop = {x: 0, y: 0};
    const knyteId = knoxels[knoxelId];
    const rects = [];
    let type = 'recursive';
    if (knyteId === knoxels[spacemapKnoxelId])
      type = 'spacemap';
    else if (knyteId in knyteTrace)
      type = 'selfviewed';
    if (type === 'recursive')
    {
      const {size} = informationMap[knyteId];
      if (size)
      {
        w = Math.max(w, size.w);
        h = Math.max(h, size.h);
      }
      let left = 1000000, right = -1000000, top = 1000000, bottom = -1000000;
      const mx = visualTheme.rect.defaultWidth/2;
      const my = visualTheme.rect.defaultHeight/2;
      const space = informationMap[knyteId].space;
      const nestedKnyteTrace = Object.assign({}, knyteTrace);
      nestedKnyteTrace[knyteId] = true;
      for (let nestedKnoxelId in space)
      {
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
        const r = {x: x - nestedW/2, y: y - nestedH/2, w: nestedW, h: nestedH, color, record, type: nestedType};
        rects.push(r);
        if (d.type === 'recursive')
          for (let i = 0; i < d.rects.length; ++i)
          {
            const rr = d.rects[i];
            rects.push({x: r.x + rr.x, y: r.y + rr.y, w: rr.w, h: rr.h, 
              color: rr.color, record: rr.record, type: rr.type});
          }
      }
      if (left < right && top < bottom)
      {
        w = right - left;
        h = bottom - top;
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
    return {w, h, leftTop, rects, type};
  }

  this.add = function(desc)
  {
    // desc: {knoxelId, position, ghost, bubble, selfcontained}

    function createShapes(rects, rootType)
    {
      const result = [];
      for (let i = 0; i < rects.length; ++i)
      {
        const rectGroup = document.createElementNS(svgNameSpace, 'g');
        const r = rects[i];
        if (rootType === 'recursive')
        {
          rectGroup.setAttribute('transform', 'translate(' + r.x + ' ' + r.y + ')');
          const rect = document.createElementNS(svgNameSpace, 'rect');
          rect.setAttribute('x', 0);
          rect.setAttribute('y', 0);
          rect.setAttribute('width', r.w);
          rect.setAttribute('height', r.h);
          rect.setAttribute('fill', r.color);
          rect.setAttribute('stroke', visualTheme.rect.strokeColor);
          rect.setAttribute('stroke-width', visualTheme.rect.recursive.strokeWidth);
          rectGroup.appendChild(rect);
          if (r.type === 'recursive' && r.record)
          {
            const info = document.createElementNS(svgNameSpace, 'foreignObject');
            const strokeW = visualTheme.rect.strokeWidth;
            info.setAttribute('x', strokeW/2);
            info.setAttribute('y', strokeW/2);
            info.setAttribute('width', r.w - strokeW);
            info.setAttribute('height', r.h - strokeW);
            info.innerHTML = r.record.viewer(r.record.data);
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
    
    function createFigure(desc)
    {
      const knyteId = knoxels[desc.knoxelId];
      const {color, record} = informationMap[knyteId];
      const knyteTrace = {};
      knyteTrace[knoxels[spaceRootElement.dataset.knoxelId]] = true;
      const {w, h, rects, type} = getFigureDimensions(desc.knoxelId, knyteTrace);
      const x = desc.position.x - w/2;
      const y = desc.position.y - h/2;
      const rectGroup = document.createElementNS(svgNameSpace, 'g');
      rectGroup.id = desc.knoxelId;
      rectGroup.classList.value = 'mouseOverRect';
      rectGroup.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      const rectRoot = document.createElementNS(svgNameSpace, 'rect');
      rectRoot.setAttribute('x', 0);
      rectRoot.setAttribute('y', 0);
      rectRoot.setAttribute('width', w);
      rectRoot.setAttribute('height', h);
      rectRoot.setAttribute('fill', color);
      rectRoot.setAttribute('stroke', visualTheme.rect.strokeColor);
      rectRoot.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
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
        const info = document.createElementNS(svgNameSpace, 'foreignObject');
        const strokeW = visualTheme.rect.strokeWidth;
        info.setAttribute('x', strokeW/2);
        info.setAttribute('y', strokeW/2);
        info.setAttribute('width', w - strokeW);
        info.setAttribute('height', h - strokeW);
        info.innerHTML = record.viewer(record.data);
        rectGroup.appendChild(info);
      }
      const shapes = createShapes(rects, type);
      for (let i = 0; i < shapes.length; ++i)
        rectGroup.appendChild(shapes[i]);
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
  
  this.getSize = function(knoxelId)
  {
    const {w, h, leftTop} = getFigureDimensions(knoxelId, {});
    return {w, h, leftTop};
  };
  
  this.setDotted = function(desc)
  {
    // desc: {knoxelId, isDotted}
    let rectElement = document.getElementById(desc.knoxelId);
    if (rectElement.tagName === 'g' && rectElement.firstElementChild.tagName === 'rect')
      rectElement = rectElement.firstElementChild;
    else
      console.error('failed ghosting for knoxelId ' + desc.knoxelId);
    if (desc.isDotted)
    {
      rectElement.setAttribute('stroke-dasharray', '0 16');
      rectElement.setAttribute('stroke-linecap', 'square');
    }
    else
    {
      rectElement.removeAttribute('stroke-dasharray');
      rectElement.removeAttribute('stroke-linecap');
    }
  };
  
  this.getElementSize = function(element)
  {
    const size = element.getBoundingClientRect();
    return {w: size.width, h: size.height};
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

function setGhostedMode(desc)
{
  // desc: {knoxelId, isGhosted}
  knoxelRect.setDotted({knoxelId: desc.knoxelId, isDotted: desc.isGhosted});
}

function setBubbledMode(desc)
{
  // desc: {knoxelId, knyteId, isBubbled}
  const spaceRootKnoxels = document.getElementById('knoxels');
  let knoxelElement = spaceRootKnoxels.firstChild;
  while (knoxelElement)
  {
    const knoxelId = knoxelElement.id;
    const knyteId = knoxels[knoxelId];
    if (
      knoxelId !== spaceRootElement.dataset.knoxelId &&
      knoxelId !== desc.knoxelId && knyteId === desc.knyteId
    )
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
  while (spaceRootKnoxels.firstChild)
    spaceRootKnoxels.firstChild.remove();
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

function addOriginsArrow(desc)
{
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
  
  // desc: {id, initialKnoxelId, terminalKnoxelId}
  const spaceRootKnyteId = knoxels[spacemapKnoxelId];
  const arrowSpace = informationMap[spaceRootKnyteId].space;
  const initialPosition = arrowSpace[desc.initialKnoxelId];
  const terminalPosition = arrowSpace[desc.terminalKnoxelId];
  let x1 = initialPosition.x;
  let y1 = initialPosition.y;
  let x2 = terminalPosition.x;
  let y2 = terminalPosition.y;
  if (desc.initialKnoxelId === desc.terminalKnoxelId)
  {
    x1 -= 10;
    x2 += 6;
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
      const initialArrowStrokeOffset = 0.5*visualTheme.arrow.strokeWidth;
      const terminalArrowStrokeOffset = 2.0*visualTheme.arrow.strokeWidth;
      const arrowIntervalStrokeOffset = 0.5*visualTheme.arrow.strokeWidth;
      const initialStrokeOffset = rectStrokeOffset + initialArrowStrokeOffset + arrowIntervalStrokeOffset;
      x1 += ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.x;
      y1 += ((1 - initialTime) * directionLength + initialStrokeOffset) * directionNormalised.y;
      const terminalStrokeOffset = rectStrokeOffset + terminalArrowStrokeOffset + arrowIntervalStrokeOffset;
      x2 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.x;
      y2 -= ((1 - terminalTime) * directionLength + terminalStrokeOffset) * directionNormalised.y;
    }
  }

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

function updateOriginsArrow(desc)
{
  // desc: {id}
  const endpoints = arrows[desc.id];
  const arrow = document.getElementById(desc.id);
  const spaceRootKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
  const arrowSpace = informationMap[spaceRootKnyteId].space;
  const initialPosition = arrowSpace[endpoints.initialKnoxelId];
  const terminalPosition = arrowSpace[endpoints.terminalKnoxelId];
  const x1 = initialPosition.x;
  const y1 = initialPosition.y;
  const x2 = terminalPosition.x;
  const y2 = terminalPosition.y;
  arrow.setAttribute('x1', x1);
  arrow.setAttribute('y1', y1);
  arrow.setAttribute('x2', x2);
  arrow.setAttribute('y2', y2);
}

function updateArrows()
{
  for (let id in arrows)
    updateOriginsArrow({id});
}

function cleanupArrows()
{
  const spaceArrows = document.getElementById('arrows');
  while (spaceArrows.firstChild)
  {
    delete arrows[spaceArrows.firstChild.id];
    spaceArrows.firstChild.remove();
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
    const color = visualTheme.rect.fillColor.getRandom();
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

function onMouseDownSpaceRoot(e)
{
}

let mouseMovePosition = {x: 0, y: 0};
let mouseMovePagePosition = {x: 0, y: 0};

function onMouseMoveSpaceRoot(e)
{
  mouseMovePosition = {x: e.clientX, y: e.clientY};
  mouseMovePagePosition = {x: e.pageX, y: e.pageY};
  if (!activeGhost.knoxelId && !activeBubble.knoxelId)
    return;
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
  const mouseoverTarget = document.elementFromPoint(mouseMovePagePosition.x, mouseMovePagePosition.y);
  const mouseoverElement = knoxelRect.getRootByTarget(mouseoverTarget);
  const mouseoverKnoxelId = mouseoverElement.classList.value === 'mouseOverRect'
    ? mouseoverElement.id : null;
  if (e.code === 'Escape')
  {
    if (activeGhost.knoxelId)
    {
      terminateGhostRect();
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
    if (activeBubble.knoxelId)
    {
      terminateBubbleRect();
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
        forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
      });
    }
  }
  else if (e.code === 'Space')
  {
    const position = mouseMovePosition;
    if (activeGhost.knoxelId)
    {
      if (!e.shiftKey && !e.altKey && !e.metaKey)
      {
        dropGhostRect(
          {
            droppedKnoxelId: activeGhost.knoxelId,
            droppedHostKnyteId: activeGhost.hostKnyteId,
            position,
          }
        );
        terminateGhostRect();
        setNavigationControlState({
          backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
          forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
        });
      }
    }
    else if (activeBubble.knoxelId)
    {
      if (!e.shiftKey && !e.altKey && !e.metaKey)
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
        setNavigationControlState({
          backKnoxelId: spaceBackStack[spaceBackStack.length - 1],
          forwardKnoxelId: spaceForwardStack[spaceForwardStack.length - 1]
        });
      }
    }
    else
    {
      if (!e.shiftKey && !e.altKey && !e.metaKey)
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
      else if (e.shiftKey && !e.altKey && !e.metaKey)
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
    }
  }
  else if (e.code === 'Enter')
  {
    const knoxelId = mouseoverKnoxelId || spaceRootElement.dataset.knoxelId;
    const knyteId = knoxels[knoxelId];
    const {record, size, color} = informationMap[knyteId];
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
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
    else if (e.shiftKey && !e.altKey && !e.metaKey)
    {
      const newSize = prompt('Edit knyte size', size ? JSON.stringify(size) : '{w: 0, h: 0}');
      if (newSize !== null)
      {
        informationMap[knyteId].size = JSON.parse(newSize);
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
    }
    else if (!e.shiftKey && e.altKey && !e.metaKey)
    {
      const newColor = prompt('Edit knyte color', color ? color : '#000000');
      if (newColor !== null)
      {
        informationMap[knyteId].color = newColor;
        setSpaceRootKnoxel({knoxelId: spaceRootElement.dataset.knoxelId}); // TODO: optimise space refresh
        handleSpacemapChanged();
      }
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
  const masterColor = visualTheme.rect.fillColor.getRandom();
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