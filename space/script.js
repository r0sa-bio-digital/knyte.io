let svgNameSpace;
const knytesCloud = {}; // core knyte id --> initial knyte id, terminal knyte id
const informationMap = {}; // knyte id --> color
const knoxels = {}; // knoxel id --> knyte id
const knoxelSpaces = {}; // root knoxel id --> nested knoxel id --> position
const visualTheme = {
  rect: {
    strokeColor: '#160f19',
    strokeWidth: 4,
    fillColor: {
      getRandom: function() {
        const colors = [
          '#79e6d9',
          '#a4a4e4',
          '#fddd88',
          '#6eca98',
          '#72c0c2',
          '#ff5d5d',
          '#55ff84',
          '#ffaabf',
          '#006280',
          '#b1419f',
          '#1da6ac',
          '#f3929f',
          '#444122',
          '#4d97ff',
          '#284a35',
          '#58243a',
          '#418cab',
          '#b98e01',
          '#36945b',
          '#b62d4e',
          '#dc286f',
          '#d820ca',
          '#5571f1',
          '#b440f1',
          '#e74141',
          '#d8b621',
          '#a4a4ff',
          '#fe84d4',
          '#ffc0cb',
          '#00fa9a',
          '#b46bd2',
          '#7460e1',
          '#0000ff',
          '#bb99ff',
          '#ffffdd',
          '#282828',
          '#333333',
          '#404040',
          '#484848',
          '#4e4e4e',
          '#565656',
          '#666666',
          '#777777',
          '#7b7b7b',
          '#898989',
          '#9b9b9b',
          '#eeeeee',
        ];
        const randomIndex = Math.floor(Math.random() * colors.length);
        return colors[randomIndex];
      }
    },
    defaultWidth: 32,
    defaultHeight: 32,
  }
};

function Knit()
{
  // Pre-calculate toString(16) for speed
  let hexBytes = [];
  for (let i = 0; i < 256; i++)
    hexBytes[i] = (i + 0x100).toString(16).substr(1);

  function binUuidV4(empty) {
    let b = new Uint8Array(16);
    if (!empty)
      crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return b;
  }

  function textUuidV4(empty) {
    var b = binUuidV4(empty);
    return hexBytes[b[0]] + hexBytes[b[1]] +
      hexBytes[b[2]] + hexBytes[b[3]] + '-' +
      hexBytes[b[4]] + hexBytes[b[5]] + '-' +
      hexBytes[b[6]] + hexBytes[b[7]] + '-' +
      hexBytes[b[8]] + hexBytes[b[9]] + '-' +
      hexBytes[b[10]] + hexBytes[b[11]] +
      hexBytes[b[12]] + hexBytes[b[13]] +
      hexBytes[b[14]] + hexBytes[b[15]];
  }

  this.empty = textUuidV4(true);
  this.new = function() {return textUuidV4();};
}
const knit = new Knit();

function addKnyte(desc)
{
  // desc: {knyteId, initialId, terminalId, color}
  knytesCloud[desc.knyteId] = {
    initialId: desc.initialId,
    terminalId: desc.terminalId
  };
  informationMap[desc.knyteId] = desc.color;
}

function addKnoxel(knyteId, rootId, knoxelId, position)
{
  // TODO: convert to desc parameter like addKnyte
  knoxels[knoxelId] = knyteId;
  if (!knoxelSpaces[knoxelId])
    knoxelSpaces[knoxelId] = {};
  if (rootId)
    knoxelSpaces[rootId][knoxelId] = position;
}

function setRectAsRoot(newSpaceRootId)
{
  const spaceRoot = document.getElementsByClassName('spaceRoot')[0];
  // check for return knoxel
  const priorSpaceRootId = spaceRoot.id;
  const priorKnyteId = knoxels[priorSpaceRootId];
  if (!knoxelSpaces[newSpaceRootId] || !Object.keys(knoxelSpaces[newSpaceRootId]).length)
    addKnoxel(
      priorKnyteId, newSpaceRootId, priorSpaceRootId,
      {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight}
    )
  // clear children
  while (spaceRoot.firstChild)
    spaceRoot.firstChild.remove();
  // set color
  const newKnyteId = knoxels[newSpaceRootId];
  spaceRoot.style.backgroundColor = informationMap[newKnyteId];
  // set actual id
  spaceRoot.id = newSpaceRootId;
  // restore all nested rects
  const nestedRects = knoxelSpaces[newSpaceRootId];
  for (let rectId in nestedRects)
    restoreRect(spaceRoot, rectId, nestedRects[rectId], informationMap[knoxels[rectId]]);
}

function onClickRect(e)
{
  setRectAsRoot(e.target.id);
  e.stopPropagation(); // to prevent onClickSpaceRoot call
}

function addRect(canvasElement, position, color)
{
  const w = visualTheme.rect.defaultHeight;
  const h = visualTheme.rect.defaultWidth;
  const x = position.x - w/2;
  const y = position.y - h/2;
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.id = knit.new();
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', color);
  rect.setAttribute('stroke', visualTheme.rect.strokeColor);
  rect.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
  rect.addEventListener('click', onClickRect, false);
  canvasElement.appendChild(rect);
  const knyteId = knit.new();
  addKnyte({knyteId, initialId: knit.empty, terminalId: knit.empty, color});
  addKnoxel(knyteId, canvasElement.id, rect.id, position);
}

function restoreRect(canvasElement, id, position, color)
{
  const w = visualTheme.rect.defaultWidth;
  const h = visualTheme.rect.defaultHeight;
  const x = position.x - w/2;
  const y = position.y - h/2;
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.id = id;
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', color);
  rect.setAttribute('stroke', visualTheme.rect.strokeColor);
  rect.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
  rect.addEventListener('click', onClickRect, false);
  canvasElement.appendChild(rect);
}

function onClickSpaceRoot(e)
{
  addRect(
    document.getElementsByClassName('spaceRoot')[0],
    {x: e.offsetX, y: e.offsetY},
    visualTheme.rect.fillColor.getRandom()
  );
}

function onResizeWindow(e)
{
  const spaceRoot = document.getElementsByClassName('spaceRoot')[0];
  spaceRoot.setAttribute('width', window.innerWidth);
  spaceRoot.setAttribute('height', window.innerHeight);
}

function onLoadBody(e)
{
  const spaceRoot = document.getElementsByClassName('spaceRoot')[0];
  svgNameSpace = spaceRoot.getAttribute('xmlns');
  spaceRoot.id = knit.new();
  const color = visualTheme.rect.fillColor.getRandom();

  const rootKnyteId = knit.new();
  addKnyte({knyteId: rootKnyteId, initialId: knit.empty, terminalId: knit.empty, color});
  addKnoxel(rootKnyteId, null, spaceRoot.id, null);
  
  const mirrorKnyteId = knit.new();
  const mirrorColor = visualTheme.rect.fillColor.getRandom();
  addKnyte({knyteId: mirrorKnyteId, initialId: knit.empty, terminalId: knit.empty, color: mirrorColor});
  const mirrorKnoxelId = knit.new();
  addKnoxel(
    mirrorKnyteId, spaceRoot.id, mirrorKnoxelId,
    {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight}
  );
  addKnoxel(
    rootKnyteId, mirrorKnoxelId, spaceRoot.id,
    {x: visualTheme.rect.defaultWidth, y: visualTheme.rect.defaultHeight}
  );

  spaceRoot.addEventListener('click', onClickSpaceRoot, false);
  setRectAsRoot(spaceRoot.id);
  
  window.addEventListener('resize', onResizeWindow, false);
  onResizeWindow();
  
  console.log('ready');
}