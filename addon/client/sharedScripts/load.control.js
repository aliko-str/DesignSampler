/* eslint-env browser */
/* global browser */

// NOTE: Should we also overwrite XMLHttpRequest.prototype.send and fetch()?

(function(){
	function _withNatCode(f) {
		return f.toString().indexOf("[native code]") > -1;
	}

	function _modCSPMeta(){
		// Not sure it works -- couldn't test it
		document.querySelectorAll("meta[http-equiv='Content-Security-Policy']").forEach(el => {
			const csp = el.getAttribute("content");
			const cspPieces = csp.split(";");
			// COPIED from br.main.js _enableEvalModifCSP - maybe one day I'll extract it in a lib
			const cspScriptSrcI = cspPieces.findIndex(str=>str.indexOf("script-src") > -1);
			if(cspScriptSrcI === -1){
				// script CSP not set -- using our values instead
				cspPieces.push(" script-src 'self' 'unsafe-eval'");
			}else{
				// script CSP is set
				if(cspPieces[cspScriptSrcI].indexOf("unsafe-eval") > -1){
					// do nothing; unsafe-eval already set
				}else{
					// add unsafe eval
					cspPieces[cspScriptSrcI] = cspPieces[cspScriptSrcI] + " 'unsafe-eval'";
				}
			}
			const newCSPVal = cspPieces.join(";");
			console.log("[LOAD CNTRL] Modifying CSP Meta head Element, FROM", csp, "TO", newCSPVal);
			el.setAttribute("content", newCSPVal);
		});
	}
	
	// function stopMarqueeAsync(){
	// 	// apparently re-inserting <marquee> starts scrolling again
	// 	return Promise.all(Array.from(document.querySelectorAll("marquee")).map((mrq)=>{
	// 		return new Promise(function(resolve, reject) {
	// 			const ifHorzScrl = mrq.direction === "left" || mrq.direction === "right";
	// 			const b = mrq.getBoundingClientRect();
	// 			const scrlBy = (ifHorzScrl)?b.width:b.height;
	// 			mrq.scrollAmount = scrlBy;
	// 			mrq.trueSpeed = true;
	// 			mrq.scrollDelay = 0; // To ensure "start" is triggered soon <-- "start" is about the new cycle
	// 			mrq.addEventListener("start", (e)=>{
	// 				console.log("[MARQUEE] %cResetting", "color:lightblue;");
	// 				mrq.scrollDelay = Number.MAX_SAFE_INTEGER;
	// 				mrq.trueSpeed = false;
	// 				mrq.scrollAmount = 0;
	// 				mrq.stop();
	// 				e.preventDefault();
	// 			});
	// 			mrq.addEventListener("start", ()=>{
	// 				resolve();
	// 			}, {"once": true});
	// 		});
	// 	}));
	// }

	// TODO: Split this F in subComponents
	function stopAllAnimations() {
		// F stops all animations, videos, DOM changes (not sure about Canvases -- maybe I should do smth with RequestAnimationFrame)
		window.pauseVideoAudio();
		try {
			const w = window.wrappedJSObject; // Working on page scripts' copy of Window, not ours
			// checking if CSP prevents us from running eval
			_modCSPMeta(); // it should also be modifined as a response header in br.main.js
			// removing intervals/timeouts
			w.eval(`
				const highestTimeoutId = window.setTimeout(";");
				for (let i = 0; i < highestTimeoutId; i++) {
					window.clearTimeout(i);
				}
				const highestIntervalId = window.setInterval(";");
				for (let i = 0; i < highestIntervalId; i++) {
					window.clearInterval(i);
				}`);
			// NOTE: this is suboptimal to call it here, but I'm out of ideas how else to disable JS and Animations at the same time --> // TODO: Maybe more all js disabling to a separate location
			window.toggleDomPrepForInstaManip("on"); // Otherwise some elements get stuck in an invisible position <-- js disabled, but CSS animations running
			// adding a counter for Stub F calls
			w.eval(`window.___stubFCallCounter = 0;`);
			const removeNonNativeWinProps = `
				(()=>{
					if(!window.___windowObjCleaned){
						console.log("Prepping to clean page window of custom props");
						const iframe = document.createElement('iframe');
						iframe.style.display = 'none';
						iframe.onload = ()=>{
							const cleanNames = Object.keys(iframe.contentWindow).concat(["___stubFCallCounter", "___windowObjCleaned"]);
							document.body.removeChild(iframe);
							const allNames = Object.keys(window);
							console.log("[PScript CLEANUP] REMOVing", allNames.length - cleanNames.length, " properties from the window object", window.location.href);
							var _i = 0;
							allNames.forEach(k => {
								if(!cleanNames.includes(k)){
									delete window[k];
									console.log("[PScript CLEANUP] %i %s", _i++, k);
								}
							});
							window.___windowObjCleaned = true;
						};
						document.body.appendChild(iframe);
					}
				})();
			`;
			const stopJsThrow = `
				if(++window.___stubFCallCounter === 100){
					try{
						console.warn("[PScript STUB] too many calls to a Stub F", window.___stubFCallCounter, "==> Do smth to avoid slow-downs.");
						console.warn("[PScript STUB] Overwriting console.log with a no-op to stop the message flood.");
						${removeNonNativeWinProps}
						console.log = ()=>{};	
					}catch (e){
						console.error("couldn't stop js execution", JSON.stringify(e));
					}
					throw "[PScript STUB] Stop JS please";
				}
			`;
			// redefining setInterval/Timeout to no-op -- hopefully animations stop.
			w.eval(`setInterval = () => {
				console.log("[PScript STUB] Page scripts trying to set an interval --> we've replaced it with no-op", window.location.href);
				${stopJsThrow}
			};`);
			w.eval(`setTimeout = () => {
				console.log("[PScript STUB] Page scripts trying to set a timeout --> we've replaced it with no-op", window.location.href);
				${stopJsThrow}
			};`);
			// Just element selection isn't enough -- we need to ensure XHRs don't 'grow' webpages after we screenshot them
			function stubPageF(className, fName, w, returnV = "null"){
				w.eval(`${className}.prototype.${fName} = ()=>{
					console.log("[PScript STUB]Page script tried to use an overwritten ${className} F, '${fName}', Doing nothing instead.", window.location.href);
					${stopJsThrow}
					return ${returnV};
				}`);				
			}
			// HTMLDocument functions to disable
			["getElementsByTagNameNS", "getElementsByTagName", "getElementsByName", "getElementsByClassName", "querySelectorAll"].forEach(f => stubPageF("HTMLDocument", f, w, "[]"));
			["getElementById", "querySelector", "createElement", "createElementNS"].forEach(f => stubPageF("HTMLDocument", f, w, "null"));
			// ELEMENT f to disble
			// setHTML <== Not yet used/available
			const domManipF2Disable = ["after", "append", "appendChild", "before", "insertAdjacentElement", "insertAdjacentHTML", "prepend", "remove", "replaceWith", "replaceChildren", "querySelector", "querySelectorAll", "attachShadow"];
			domManipF2Disable.forEach(fName => stubPageF("HTMLElement", fName, w));
			// Node f to disable
			["insertBefore", "appendChild", "replaceChild", "removeChild"].forEach(f => stubPageF("Node", f, w));
			// Class adding via Element.setProperty
			w.eval(`HTMLElement.prototype.setAttribute = (a, b)=>console.log("[PScript STUB] Trying to set setAttribute", a, b);`);
			// DIRECT html-as-string manipulation
			w.eval(`Object.defineProperty(Element.prototype, "innerHTML", {
				set (v){console.log("[PScript STUB] not SETTING HTML", v);}, 
				get(){console.log("[PScript STUB][Asking for html]"); return ""},  
				enumerable: true,
				configurable: true
			});`);
			// BELOW: Trying to stop WordPress animations without the nuclear option of overwriting Function.prototype.call/apply which are so beloved by lib devs
			// "content_security_policy": "script-src 'self' 'unsafe-eval'; object-src 'self';",
			const overwriteCSS2Prop = (propName, w)=>{
				const tmplt = `Object.defineProperty(CSS2Properties.prototype, "${propName}", {set(a){
					console.log("[PScript STUB] Not setting ${propName.toUpperCase()} style", (a || "undefined").toString());
					${stopJsThrow}
					// console.stack();
					return "";
				}});`;
				w.eval(tmplt);
			};
			// NUCLEAR option -- disabling setters on all CSS2Properties
			const allCssProps2Disable = window.__getAllCssPropList();
			//const allCssProps2Disable = ["left", "display", "opacity", "transform", "MozTransform", "webkitTransform", "WebkitTransform"]
			allCssProps2Disable.forEach(cssProp => {
				overwriteCSS2Prop(cssProp, w);
			});
			// Preventing event Dispatching - no idea how to stop JS animations otherwise (they save a copy to setTimeout)
			w.eval(`EventTarget.prototype.dispatchEvent = function(e){console.log("[PScript STUB] Preventing an event: ", e.type, location.href)};`);
			// Disabling in-built animations
			w.eval(`Element.prototype.animate = function(){console.log("[PScript STUB] Preventing built-in Animation: ", ...arguments)}`);
			w.eval(`window.stop();`);
			window.dispatchEvent(new Event("StopEventHandling"));
		} catch (err) {
			console.error(err.toString(), "\nSTACK TRACE: ", err.stack, location.href);
		}
		console.log("Animation Freezing finished for", window.location.href);
		document.documentElement.dispatchEvent(new Event("UIFrozen"));
	};
	
	function pauseVideoAudio(){
		const avEls = Array.from(document.querySelectorAll("video, audio"));
		if(avEls.length){
			console.log("Audio/video elements -- pausing them, n: ", avEls.length, location.href);
			avEls.forEach(el => {
				el.pause();
			});
		}
	}

	function _waitForAllImagesToLoad(callback) {
	//	console.log("WAITING FOR images in an iframe");
		const element = document.body;
		var allImgsLength = 0;
		var allImgsLoaded = 0;
		var allImgs = [];

		var filtered = Array.prototype.filter.call(element.querySelectorAll('img'), function (item) {
			if (item.src === '') {
				return false;
			}

			// Firefox's `complete` property will always be `true` even if the image has not been downloaded.
			// Doing it this way works in Firefox.
			var img = new Image();
			img.src = item.src;
			return !img.complete;
		});

		allImgs = filtered.map(item => ({
			src: item.src,
			element: item
		}));

		allImgsLength = allImgs.length;
		allImgsLoaded = 0;

		// If no images found, don't bother.
		if (allImgsLength === 0) {
			return callback.call(element);
		}

		console.log("Images to load", allImgs.length, JSON.stringify(allImgs));

		allImgs.forEach(function (img) {
			var image = new Image();

			// Handle the image loading and error with the same callback.
			image.addEventListener('load', function () {
				allImgsLoaded++;
				// console.log("Loaded an image");
				if (allImgsLoaded === allImgsLength) {
					callback.call(element);
					return false;
				}
			});

			image.addEventListener('error', function () {
				allImgsLoaded++;
				// console.log("Error loading an image");
				if (allImgsLoaded === allImgsLength) {
					callback.call(element);
					return false;
				}
			});

			image.src = img.src;
		});
	};
	
	const _alarmPr = (duration)=>{
		// because Google Ads mess with window.setTimeout and it no longer fires -- I don't know how they do it, since page scripts are supposed to have a difference version of "window" (different from content scripts)
		return browser.runtime.sendMessage({
			"action": "timeout",
			"duration": duration
		});
	};
	
	window.waitForAllImagesToLoad = function(cb){
		window.setTimeout(()=>{
			_waitForAllImagesToLoad(cb);
		}, 100); // small timeout - otherwise many images aren't found for some reason
	};
	
	// window.stopMarqueeAsync = stopMarqueeAsync;
	window._alarmPr = _alarmPr;
	window.pauseVideoAudio = pauseVideoAudio;
	window.stopAllAnimations = stopAllAnimations;
})();
