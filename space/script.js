let svgNameSpace;

function onClickVisualRoot(e)
{
  const visualRoot = document.getElementById('visualRoot');
  const rect = document.createElementNS(svgNameSpace, 'rect');
  rect.setAttribute('x', e.offsetX);
  rect.setAttribute('y', e.offsetY);
  rect.setAttribute('height', '16');
  rect.setAttribute('width', '16');
  rect.setAttribute('fill', 'aqua');
  rect.setAttribute('stroke', 'blue');
  visualRoot.appendChild(rect);
}

function onLoadBody(e)
{
  const visualRoot = document.getElementById('visualRoot');
  svgNameSpace = visualRoot.getAttribute('xmlns');
  visualRoot.addEventListener('click', onClickVisualRoot, false);
  console.log('ready');
}