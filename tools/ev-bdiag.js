await new Promise(r=>setTimeout(r,2000));
return JSON.stringify({
  title:document.title,
  bodyLen:document.body?document.body.innerHTML.length:-1,
  ids:['sum','scaleTxt','panes','stats','preset','mode','reload','vinfo']
        .map(i=>i+'='+(document.getElementById(i)?'ok':'NULL')),
  iframes:document.querySelectorAll('iframe').length,
  statRows:document.querySelectorAll('.stat').length,
  firstChild:document.body?document.body.firstElementChild.className:null,
  head:document.head.innerHTML.length
});
