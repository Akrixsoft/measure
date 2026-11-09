/* Measure Lab 0.3: placing any wall object never generates dimension arrows.
 * Native wall geometry fields and explicit user-drawn dm/arr/RZ remain intact. */
(() => {
  'use strict';
  drawAutoDims=function(){S.adH=[];if(window.MeasureLabGeometry){MeasureLabGeometry.autoAnchors=[];MeasureLabGeometry.lastAutoLine=null;}};
  PM.drawAutoDims=(...args)=>drawAutoDims(...args);
  if(window.MeasureLabGeometry){MeasureLabGeometry.autoAnchors=[];MeasureLabGeometry.lastAutoLine=null;}
  S.adH=[];
  // Do not delete any stored arrows: existing manual measurements are user data.
  window.MeasureLabManual={version:3,objectAutoDimensions:false};
  draw();
})();
