let svgNameSpace;
const visualTheme = {
  canvas: {
    color: '#160f19',
  },
  rect: {
    strokeColor: '#ffffdd',
    strokeWidth: 4,
    fillColor: '#ffc0cb',
    defaultWidth: 32,
    defaultHeight: 32,
  }
};

function addRect(canvasElement, position)
{
  const w = visualTheme.rect.defaultHeight;
  const h = visualTheme.rect.defaultWidth;
  const x = position.x - w/2;
  const y = position.y - h/2;
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', w);
  rect.setAttribute('height', h);
  rect.setAttribute('fill', visualTheme.rect.fillColor);
  rect.setAttribute('stroke', visualTheme.rect.strokeColor);
  rect.setAttribute('stroke-width', visualTheme.rect.strokeWidth);
  canvasElement.appendChild(rect);
}

function onClickVisualRoot(e)
{
  addRect(
    document.getElementById('visualRoot'),
    {x: e.offsetX, y: e.offsetY}
  );
}

function onResizeWindow(e)
{
  const visualRoot = document.getElementById('visualRoot');
  visualRoot.setAttribute('width', window.innerWidth);
  visualRoot.setAttribute('height', window.innerHeight);
}

function onLoadBody(e)
{
  const visualRoot = document.getElementById('visualRoot');
  visualRoot.style.backgroundColor = visualTheme.canvas.color;
  svgNameSpace = visualRoot.getAttribute('xmlns');
  visualRoot.addEventListener('click', onClickVisualRoot, false);
  window.addEventListener('resize', onResizeWindow, false);
  onResizeWindow();
  console.log('ready');
}