/* a stand-in "fancy letter png": a big serif R on transparency */
const c = document.createElement('canvas');
c.width = 600; c.height = 760;
const x = c.getContext('2d');
x.clearRect(0, 0, 600, 760);
x.fillStyle = '#fff';
x.font = 'bold 780px Georgia, "Times New Roman", serif';
x.textBaseline = 'alphabetic';
x.textAlign = 'center';
x.fillText('R', 300, 730);
const url = c.toDataURL('image/png');
await fetch('/_save?name=_testletter.png', { method: 'POST', body: url.split(',')[1] });
return { saved: url.length };
