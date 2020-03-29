let svgNameSpace;
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

let hexBytes = [];
// Pre-calculate toString(16) for speed
for (let i = 0; i < 256; i++)
{
  hexBytes[i] = (i + 0x100).toString(16).substr(1);
}

// String UUIDv4 (Random)
function uuid() {
  // uuid.bin
  function uuidBin() {
    let b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return b;
  }

  var b = uuidBin();
  return hexBytes[b[0]] + hexBytes[b[1]] +
    hexBytes[b[2]] + hexBytes[b[3]] + '-' +
    hexBytes[b[4]] + hexBytes[b[5]] + '-' +
    hexBytes[b[6]] + hexBytes[b[7]] + '-' +
    hexBytes[b[8]] + hexBytes[b[9]] + '-' +
    hexBytes[b[10]] + hexBytes[b[11]] +
    hexBytes[b[12]] + hexBytes[b[13]] +
    hexBytes[b[14]] + hexBytes[b[15]];
}

function setRectAsRoot(newVisualRootId)
{
  const visualRoot = document.getElementsByClassName('visualRoot')[0];
  // set color
  visualRoot.style.backgroundColor = document.getElementById(newVisualRootId).getAttribute('fill');
  // clear children
  while (visualRoot.firstChild)
    visualRoot.firstChild.remove();
  // set actual id
  visualRoot.id = newVisualRootId;
}

function onClickRect(e)
{
  setRectAsRoot(e.target.id);
  e.stopPropagation(); // to prevent onClickVisualRoot call
}

function addRect(canvasElement, position)
{
  const w = visualTheme.rect.defaultHeight;
  const h = visualTheme.rect.defaultWidth;
  const x = position.x - w/2;
  const y = position.y - h/2;
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.id = uuid();
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', visualTheme.rect.fillColor.getRandom());
  rect.setAttribute('stroke', visualTheme.rect.strokeColor);
  rect.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
  rect.addEventListener('click', onClickRect, false);
  canvasElement.appendChild(rect);
}

function onClickVisualRoot(e)
{
  addRect(
    document.getElementsByClassName('visualRoot')[0],
    {x: e.offsetX, y: e.offsetY}
  );
}

function onResizeWindow(e)
{
  const visualRoot = document.getElementsByClassName('visualRoot')[0];
  visualRoot.setAttribute('width', window.innerWidth);
  visualRoot.setAttribute('height', window.innerHeight);
}

function onLoadBody(e)
{
  const visualRoot = document.getElementsByClassName('visualRoot')[0];
  visualRoot.id = uuid();
  visualRoot.style.backgroundColor = visualTheme.rect.fillColor.getRandom();
  svgNameSpace = visualRoot.getAttribute('xmlns');
  visualRoot.addEventListener('click', onClickVisualRoot, false);
  window.addEventListener('resize', onResizeWindow, false);
  onResizeWindow();
  console.log('ready');
}