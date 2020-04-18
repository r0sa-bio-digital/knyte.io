/* global visualThemeColors */
/* global intersect */

let svgNameSpace;
let spaceRootElement;
let spaceBackElement;
let spaceForwardElement;
let spaceMapElement;
let spaceHostElement;
let masterKnoxelId;
let spacemapKnoxelId;
let handleSpacemapChanged = function() {};
const knytesCloud = {}; // core knyte id --> {initialKnyteId, terminalKnyteId}
const informationMap = {}; // knyte id --> {color, space: {knoxel id --> position}}
const knoxels = {}; // knoxel id --> knyte id
const arrows = {}; // arrow id --> {initialKnoxelId, terminalKnoxelId}
const spaceBackStack = []; // [previous space root knoxel id]
const spaceForwardStack = []; // [next space root knoxel id]
const visualTheme = {
  rect: {
    strokeColor: visualThemeColors.outline,
    strokeWidth: 4,
    selfcontained: {
      rx: 8
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
}

function addKnoxel(desc)
{
  // desc: {hostKnyteId, knyteId, knoxelId, position, spacemap}
  knoxels[desc.knoxelId] = desc.knyteId;
  if (desc.hostKnyteId)
    informationMap[desc.hostKnyteId].space[desc.knoxelId] = desc.position;
  if (!desc.spacemap)
    handleSpacemapChanged();
}

function setGhostedMode(desc)
{
  // desc: {knoxelId, isGhosted}
  const knoxelElement = document.getElementById(desc.knoxelId);
  if (desc.isGhosted)
  {
    knoxelElement.setAttribute('stroke-dasharray', '0 16');
    knoxelElement.setAttribute('stroke-linecap', 'square');
  }
  else
  {
    knoxelElement.removeAttribute('stroke-dasharray');
    knoxelElement.removeAttribute('stroke-linecap');
  }
}

function setSpaceRootKnoxel(desc)
{
  // desc: {knoxelId}
  const priorKnoxelId = spaceRootElement.dataset.knoxelId;
  const newKnoxelId = desc.knoxelId;
  const newKnyteId = knoxels[newKnoxelId];
  // clear children rects
  const spaceRootKnoxels = document.getElementById('knoxels');
  while (spaceRootKnoxels.firstChild)
    spaceRootKnoxels.firstChild.remove();
  // reset mouseover knoxel cause of changing space
  if (newKnoxelId !== priorKnoxelId)
      mouseoverGhostKnoxelId = null;
  // set actual knoxel id and space color
  spaceRootElement.dataset.knoxelId = newKnoxelId;
  spaceRootElement.style.backgroundColor = informationMap[newKnyteId].color;
  // restore all nested rects
  const nestedKnoxels = informationMap[newKnyteId].space;
  for (let knoxelId in nestedKnoxels)
  {
    const selfcontained = knoxelId === spaceRootElement.dataset.knoxelId;
    addRect(
      {
        id: knoxelId,
        position: nestedKnoxels[knoxelId],
        color: informationMap[knoxels[knoxelId]].color,
        selfcontained,
      }
    );
    if (knoxelId === activeGhost.knoxelId)
      setGhostedMode({knoxelId, isGhosted: true});
  }
  // control arrows display
  const arrowsElement = document.getElementById('arrows');
  arrowsElement.style.display = newKnyteId === knoxels[spacemapKnoxelId]
    ? 'block' : 'none';
}

function addRect(desc)
{
  // desc: {id, position, color, ghost, selfcontained}
  const w = visualTheme.rect.defaultWidth;
  const h = visualTheme.rect.defaultHeight;
  const x = desc.position.x - w/2;
  const y = desc.position.y - h/2;
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.id = desc.id;
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', desc.color);
  rect.setAttribute('stroke', visualTheme.rect.strokeColor);
  rect.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
  if (desc.selfcontained)
  {
    rect.setAttribute('rx', visualTheme.rect.selfcontained.rx);
  }
  if (desc.ghost)
  {
    rect.setAttribute('opacity', 0.5);
    rect.style.pointerEvents = 'none';
    document.getElementById('ghosts').appendChild(rect);
  }
  else
  {
    rect.addEventListener('click', onClickRect, false);
    rect.addEventListener('mouseover', onMouseOverRect, false);
    rect.addEventListener('mouseout', onMouseOutRect, false);
    document.getElementById('knoxels').appendChild(rect);
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
      const initialTime = collideAABBVsLine(
        {position: initialPosition, dimension: {w, h}},
        {position1: terminalPosition, position2: initialPosition}
      );
      const terminalTime = collideAABBVsLine(
        {position: terminalPosition, dimension: {w, h}},
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
  // desc: {knyteId, position}
  const position = activeGhost.knoxelId
    ? {x: desc.position.x + activeGhost.offset.x, y: desc.position.y + activeGhost.offset.y}
    : desc.position;
  const hostKnyteId = knoxels[spaceRootElement.dataset.knoxelId];
  const knoxelId = knit.new();
  const color = informationMap[desc.knyteId].color;
  addKnoxel({hostKnyteId, knyteId: desc.knyteId, knoxelId, position});
  addRect({id: knoxelId, position, color});  
}

function onClickRect(e)
{
  if (!e.shiftKey && !e.altKey && !e.metaKey)
  {
    if (e.target.id !== spaceRootElement.dataset.knoxelId)
    {
      spaceBackStack.push(spaceRootElement.dataset.knoxelId);
      spaceForwardStack.length = 0;
      setSpaceRootKnoxel({knoxelId: e.target.id});
      setNavigationControlState({
        backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
      });
    }
    e.stopPropagation(); // to prevent onClickSpaceRoot call
  }
}

let mouseoverGhostKnoxelId = null;
let mouseMovePosition = {x: 0, y: 0};

function onMouseOverRect(e)
{
  mouseoverGhostKnoxelId = e.target.id;
}

function onMouseOutRect(e)
{
  if (e.target.id === mouseoverGhostKnoxelId)
    mouseoverGhostKnoxelId = null;
}

function onClickSpaceRoot(e)
{
  const position = {x: e.offsetX, y: e.offsetY};
  if (!e.shiftKey && !e.altKey && e.metaKey)
  {
    const knyteId = knit.new();
    const color = visualTheme.rect.fillColor.getRandom();
    addKnyte({knyteId, initialKnyteId: knit.empty, terminalKnyteId: knit.empty, color});
    addKnoxelRect({knyteId, position});
  }
  else if (!e.shiftKey && e.altKey && !e.metaKey)
  {
    if (activeGhost.knoxelId)
    {
      const knyteId = knoxels[activeGhost.knoxelId];
      addKnoxelRect({knyteId, position});
    }
  }
}

function onClickSpaceMap(e)
{
  if (spaceRootElement.dataset.knoxelId === spacemapKnoxelId)
    return;
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  spaceForwardStack.length = 0;
  setSpaceRootKnoxel({knoxelId: spacemapKnoxelId});
  setNavigationControlState({
    backKnoxelId: spaceBackStack[spaceBackStack.length - 1]
  });
}

function onClickSpaceHost(e)
{
  if (!activeGhost.hostKnoxelId)
    return;
  spaceBackStack.push(spaceRootElement.dataset.knoxelId);
  spaceForwardStack.length = 0;
  setSpaceRootKnoxel({knoxelId: activeGhost.hostKnoxelId});
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
    spaceHostElement.style.display = activeGhost.hostKnoxelId && 
    activeGhost.hostKnoxelId !== spaceRootElement.dataset.knoxelId
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

const activeGhost = {
  knoxelId: null,
  hostKnoxelId: null,
  offset: {x: 0, y: 0},
  element: null
};

function spawnGhostRect(desc)
{
  // desc: {ghostKnoxelId, ghostHostKnoxelId, position}
  activeGhost.knoxelId = desc.ghostKnoxelId;
  activeGhost.hostKnoxelId = desc.ghostHostKnoxelId;
  const knyteId = knoxels[desc.ghostKnoxelId];
  const color = informationMap[knyteId].color;
  const id = desc.ghostKnoxelId + '.ghost';
  const selfcontained = desc.ghostKnoxelId === spaceRootElement.dataset.knoxelId;
  const ghostHostKnoxelSpace = informationMap[knoxels[desc.ghostHostKnoxelId]].space;
  addRect({id, position: desc.position, color, ghost: true});
  activeGhost.element = document.getElementById(id);
  if (selfcontained)
  {
    activeGhost.offset = {x: 0, y: 0};
    if (desc.ghostKnoxelId in ghostHostKnoxelSpace)
      setGhostedMode({knoxelId: desc.ghostKnoxelId, isGhosted: true});
  }
  else
  {
    const knoxelPosition = ghostHostKnoxelSpace[desc.ghostKnoxelId];
    activeGhost.offset = {
      x: knoxelPosition.x - desc.position.x, 
      y: knoxelPosition.y - desc.position.y
    };
    activeGhost.element.setAttribute(
      'transform', 
      'translate(' + activeGhost.offset.x + ' ' + activeGhost.offset.y + ')'
    );
    setGhostedMode({knoxelId: desc.ghostKnoxelId, isGhosted: true});
  }
}

function terminateGhostRect()
{
  activeGhost.element.remove();
  const knyteId = knoxels[spaceRootElement.dataset.knoxelId];
  if (activeGhost.knoxelId in informationMap[knyteId].space)
    setGhostedMode({knoxelId: activeGhost.knoxelId, isGhosted: false});
  activeGhost.knoxelId = null;
  activeGhost.hostKnoxelId = null;
  activeGhost.offset = {x: 0, y: 0};
  activeGhost.element = null;
}

function onMouseDownSpaceRoot(e)
{
}

function onMouseMoveSpaceRoot(e)
{
  mouseMovePosition = {x: e.offsetX, y: e.offsetY};
  if (!activeGhost.knoxelId)
    return;
  const w = visualTheme.rect.defaultWidth;
  const h = visualTheme.rect.defaultHeight;
  const x = mouseMovePosition.x - w/2;
  const y = mouseMovePosition.y - h/2;
  activeGhost.element.setAttribute('x', x);
  activeGhost.element.setAttribute('y', y);
}

function onMouseUpSpaceRoot(e)
{
}

function dropGhostRect(desc)
{
  // desc: {droppedKnoxelId, droppedHostKnyteId, landingKnoxelId, position}
  const landingKnyteId = knoxels[desc.landingKnoxelId];
  if (
    desc.droppedKnoxelId === desc.landingKnoxelId &&
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

function onKeyDownWindow(e)
{
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
  }
  else if (e.code === 'Space')
  {
    if (!e.shiftKey && !e.altKey && !e.metaKey)
    {
      const position = mouseMovePosition;
      if (!activeGhost.knoxelId)
      {
        const ghostKnoxelId = mouseoverGhostKnoxelId || spaceRootElement.dataset.knoxelId;
        const ghostHostKnoxelId = spaceRootElement.dataset.knoxelId;
        spawnGhostRect({ghostKnoxelId, ghostHostKnoxelId, position});
      }
      else
      {
        const droppedHostKnoxelId = activeGhost.hostKnoxelId;
        const landingKnoxelId = spaceRootElement.dataset.knoxelId;
        dropGhostRect(
          {
            droppedKnoxelId: activeGhost.knoxelId,
            droppedHostKnyteId: knoxels[droppedHostKnoxelId],
            landingKnoxelId, position,
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
    addKnoxel({hostKnyteId: spacemapKnyteId, knyteId, knoxelId, position, spacemap: true});
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
  masterKnoxelId = knit.new();
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