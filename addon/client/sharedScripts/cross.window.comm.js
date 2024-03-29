/* eslint-env browser */

(()=>{
	// we need to ensure that nested iframes reply/fail2reply before their parent stops waiting and declare a failure
	function __counteIFrameNestedness(){
		var w = window;
		var counter = 1;
		while(w !== window.top){
			counter++;
			w = w.parent;
			if(counter > 100){ // fool check
				throw "We failed to reach the top window from a nested iframe --> debug.";
			}
		}
		return counter;
	}
	const TIMEOUT_REPLY_FROM_IFRAME = 1500/__counteIFrameNestedness();
	
	function askSubFr4WinSizes(visIframesArr){
		const abortCntrlArr = []; // so we can remove eventListeners without calling removeEventListener within itself -- Just to try smth new
		window.dispatchEvent(new Event("StopEventHandling")); // Temporarly stoppping so our frame-window communication triggers nothing
		const prArr = visIframesArr.map((ifrEl, i)=>{
			return new Promise(function(resolve, reject) {
				const msgId = Math.round(Math.random() * 10000);
				let _done = false;
				abortCntrlArr.push(new AbortController());
				window.setTimeout(()=>{
					if(!_done){
						console.error("IFrame failed to respond to TellPapaYourMachineId; It'll be replaced with shadowDom or treated as an 'invisible' iframe", window.__el2stringForDiagnostics(ifrEl));
						window.extractLocalIFramesInShadowDow([ifrEl]);
						reject();
					}
				}, TIMEOUT_REPLY_FROM_IFRAME);//diagnostics
				window.addEventListener("message", (e)=>{
					if(e.data.action === "HaveYourMachineId" && e.data.msgId === msgId){
						ifrEl.__machineFrameId = e.data.machineFrameId;
						ifrEl.__internalWinSize = e.data.winSize;
						ifrEl.__subFrResArr = e.data.__subFrResArr;
						_done = true;
						resolve();
					}
				}, "*", {signal: abortCntrlArr[i].signal});
				ifrEl.contentWindow.postMessage({action: "TellPapaYourMachineId", msgId: msgId}, "*");
			});
		});
		return Promise.allSettled(prArr).then(()=>{
			// window.dispatchEvent(new Event("StartEventHandling")); // In case some of the rendering isn't finished?... // <-- disabling -- re-enables all animations on the main window
			abortCntrlArr.forEach(x => x.abort()); // removing listeners for HaveYourMachineId
			return visIframesArr;
		});
	}
	
	function __findIFramesInShadowRoots(visElArr){
		const shadowRoots = visElArr
			.map(x=>x.openOrClosedShadowRoot)
			.filter(x=>x);
		debugger;
		console.log("N shadowRoots:", shadowRoots.length, location.href);
		const nestedEls = shadowRoots.map(root=>Array.from(root.querySelectorAll(":not(style)")));
		return shadowRoots
			.map(root=>Array.from(root.querySelectorAll("iframe")))
			.flat(1)
			.concat(nestedEls.length?__findIFramesInShadowRoots(nestedEls):[]); // potential shadow-nested elements
	}
	
	function propagateFrVisReqsAsync(){
		const visIFrames = window.domGetters.getAllVis().filter("iframe").toArray();
		const inShadowRootIFrames =  __findIFramesInShadowRoots(window.domGetters.getAllVis().toArray());
		if(inShadowRootIFrames.length){
			console.log("[IFr Vis Check] %cFound iframes nested in shadow roots, n: %i", "color:yellow;", inShadowRootIFrames.length);
		}
		const allIFrames = visIFrames.concat(inShadowRootIFrames);
		if(!allIFrames.length){
			return Promise.resolve(); // no nested iframes to process
		}
		return askSubFr4WinSizes(allIFrames)
			.then(visFrInfoArr=>{
				const res = visFrInfoArr
					.filter(el => el.__machineFrameId !== undefined)
					.filter(el => {
						console.assert(el.__internalWinSize !== undefined);
						return el.__internalWinSize > window.MIN_VIS_IFRAME_SIZE;
					})
					.filter(el => {
						const ifrB = window._getAbsBoundingRectAdjForParentOverflow(el, true);
						return Math.max(ifrB.height, 0) * Math.max(ifrB.width, 0) > window.MIN_VIS_IFRAME_SIZE; //getAllVis should really take care of this, but it doesn't happen sometimes (when devTools are open)
					})
					.map(el=>{
						const ifrB = window._getAbsBoundingRectAdjForParentOverflow(el, true);
						const src = el.src || window.EMPTY_SRC;
						const frInfoArr =  [{
							height: ifrB.height,
							width: ifrB.width,
							absTop: ifrB.top + window.scrollY,
							absLeft: ifrB.left + window.scrollX,
							src: src,
							machineFrameId: el.__machineFrameId
						}];
						if(el.__subFrResArr){
							// adjust nested frames' absTop/left
							frInfoArr.push(...el.__subFrResArr.map(infoObj=>{
								infoObj.absTop += ifrB.top;
								infoObj.absLeft += ifrB.left;
								return infoObj;
							}));
						}
						return frInfoArr;
					}).flat();
				// console.log(res, window.location.href);
				return res;
			});
	}
	
	window.propagateFrVisReqsAsync = propagateFrVisReqsAsync;
	// window.askSubFr4WinSizes = askSubFr4WinSizes;
	window.MIN_VIS_IFRAME_SIZE = 25; // pixels, adsense sometimes uses 4 by 4, so we should fit in
	window.EMPTY_SRC = "about:blank"; //"[EMPTY_SRC_IFRAME]"; //getAllFrames returns about:blank for empty src, so we set it here to have a match
})();
