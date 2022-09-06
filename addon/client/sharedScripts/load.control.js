/* eslint-env browser */
/* global browser */

// NOTE: Should we also overwrite XMLHttpRequest.prototype.send and fetch()?

(function(){
	const cleanNames = "'close', 'stop', 'focus', 'blur', 'open', 'alert', 'confirm', 'prompt', 'print', 'postMessage', 'captureEvents', 'releaseEvents', 'getSelection', 'getComputedStyle', 'matchMedia', 'moveTo', 'moveBy', 'resizeTo', 'resizeBy', 'scroll', 'scrollTo', 'scrollBy', 'requestAnimationFrame', 'cancelAnimationFrame', 'getDefaultComputedStyle', 'scrollByLines', 'scrollByPages', 'sizeToContent', 'updateCommands', 'find', 'dump', 'setResizable', 'requestIdleCallback', 'cancelIdleCallback', 'btoa', 'atob', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'createImageBitmap', 'fetch', 'self', 'name', 'history', 'customElements', 'locationbar', 'menubar', 'personalbar', 'scrollbars', 'statusbar', 'toolbar', 'status', 'closed', 'event', 'frames', 'length', 'opener', 'parent', 'frameElement', 'navigator', 'clientInformation', 'external', 'applicationCache', 'screen', 'innerWidth', 'innerHeight', 'scrollX', 'pageXOffset', 'scrollY', 'pageYOffset', 'screenLeft', 'screenTop', 'screenX', 'screenY', 'outerWidth', 'outerHeight', 'performance', 'mozInnerScreenX', 'mozInnerScreenY', 'devicePixelRatio', 'scrollMaxX', 'scrollMaxY', 'fullScreen', 'ondevicemotion', 'ondeviceorientation', 'onabsolutedeviceorientation', 'InstallTrigger', 'sidebar', 'visualViewport', 'crypto', 'onabort', 'onblur', 'onfocus', 'onauxclick', 'onbeforeinput', 'oncanplay', 'oncanplaythrough', 'onchange', 'onclick', 'onclose', 'oncontextmenu', 'oncuechange', 'ondblclick', 'ondrag', 'ondragend', 'ondragenter', 'ondragexit', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'ondurationchange', 'onemptied', 'onended', 'onformdata', 'oninput', 'oninvalid', 'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onloadeddata', 'onloadedmetadata', 'onloadend', 'onloadstart', 'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onwheel', 'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onreset', 'onresize', 'onscroll', 'onseeked', 'onseeking', 'onselect', 'onstalled', 'onsubmit', 'onsuspend', 'ontimeupdate', 'onvolumechange', 'onwaiting', 'onselectstart', 'ontoggle', 'onpointercancel', 'onpointerdown', 'onpointerup', 'onpointermove', 'onpointerout', 'onpointerover', 'onpointerenter', 'onpointerleave', 'ongotpointercapture', 'onlostpointercapture', 'onmozfullscreenchange', 'onmozfullscreenerror', 'onanimationcancel', 'onanimationend', 'onanimationiteration', 'onanimationstart', 'ontransitioncancel', 'ontransitionend', 'ontransitionrun', 'ontransitionstart', 'onwebkitanimationend', 'onwebkitanimationiteration', 'onwebkitanimationstart', 'onwebkittransitionend', 'u2f', 'onerror', 'speechSynthesis', 'onafterprint', 'onbeforeprint', 'onbeforeunload', 'onhashchange', 'onlanguagechange', 'onmessage', 'onmessageerror', 'onoffline', 'ononline', 'onpagehide', 'onpageshow', 'onpopstate', 'onrejectionhandled', 'onstorage', 'onunhandledrejection', 'onunload', 'ongamepadconnected', 'ongamepaddisconnected', 'localStorage', 'origin', 'crossOriginIsolated', 'isSecureContext', 'indexedDB', 'caches', 'sessionStorage', 'window', 'document', 'location', 'top', '___stubFCallCounter', '___windowObjCleaned', '___origSetIntervalF', '__pageScriptEventsAllowed', '___origSetTimeoutF', '___stopLogs'";
	// var cleanNames;
	// (()=>{
	// 	const iframe = document.createElement('iframe');
	// 	iframe.style.display = 'none';
	// 	iframe.onload = ()=>{
	// 		cleanNames = "'" + Object.keys(iframe.contentWindow).concat(["___stubFCallCounter", "___windowObjCleaned"]).join("', '") + "'";
	// 		document.body.removeChild(iframe);
	// 	};
	// 	document.body.appendChild(iframe);
	// })();
	
	function ytFix(){
		// dumb YouTube fix
		document.querySelectorAll("[aria-label*='Hide more videos']").forEach(x=>x.click());
	}
	
	function _withNatCode(f) {
		return f.toString().indexOf("[native code]") > -1;
	}
	
	const getPageLoadedPr = (()=>{
		var pr;
		const defaultTOutDelay = 6000;
		const tStart = Date.now();
		const __set = ()=>{
			if (document.readyState === "complete") {
				pr = Promise.resolve();
			} else {
				pr = new Promise(function(resolve, reject) {
					window.addEventListener("load", ()=>{
						resolve();
					});
				});
			}	
		};
		__set();
		return (tOutDelay = undefined, tOutWarnF = ()=>{}, __reset = false)=>{
			if(tOutDelay !== undefined){
				tOutDelay = defaultTOutDelay;
			}
			// NOTE: this part was intended to handle non-loading (infinite load) pages, but it no longer does - we inject this script at "document_end", which means after "load" ==> We should handle non-loads in br.main.js
			const realDelay = Math.max(0, tOutDelay - (Date.now() - tStart));
			// const realDelay = tOutDelay;
			return Promise
				.race([pr, _alarmPr(realDelay).then(()=>{ return {tmdOut: true}; })])
				.then((x)=>{
					if(x && x.tmdOut){ tOutWarnF(); };
				});
		};
	})();

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
				if(highestTimeoutId && !window.isNaN(highestTimeoutId)){
					for (let i = 0; i < highestTimeoutId; i++) {
						window.clearTimeout(i);
					}					
				}
				const highestIntervalId = window.setInterval(";");
				if(highestIntervalId && !window.isNaN(highestIntervalId)){
					for (let i = 0; i < highestIntervalId; i++) {
						window.clearInterval(i);
					}					
				}`);
			// NOTE: this is suboptimal to call it here, but I'm out of ideas how else to disable JS and Animations at the same time --> // TODO: Maybe more all js disabling to a separate location
			window.toggleDomPrepForInstaManip("on"); // Otherwise some elements get stuck in an invisible position <-- js disabled, but CSS animations running
			// NOTE: disabling selectors kills the js runtime on Youtube -- trying out this temporary hack of not doing this for youtube -- other options: unwrap iframes in DIVs; replace iframes with screenshots
			const urls2skipJsOverwriting = ["youtube", "youtu.be"]; //, "www.google.com"
			// const urls2skipJsOverwriting = [];
			if(urls2skipJsOverwriting.some(x=>location.host.indexOf(x) > -1)){
				console.log("[PScript STUB]%c NOT Overwriting JS for this host: %s", "color:orange;background-color:darkgreen;", location.host);
				ytFix();
			}else{
				// adding a counter for Stub F calls
				w.eval(`window.___stubFCallCounter = 0;`);
				const removeNonNativeWinProps = `
					(()=>{
						if(!window.___windowObjCleaned){
							console.log("Prepping to clean page window of custom props");
							const cleanNames = [${cleanNames}];
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
						}
					})();
				`;
				const stopJsThrow = `
					if(window.___stubFCallCounter > 100){
						debugger;
					}
					if(++window.___stubFCallCounter === 100){
						console.log("%c[PScript STUB] too many calls to a Stub F", "color:pink;font-style:oblique;", window.___stubFCallCounter, "==> Do smth to avoid slow-downs. For now, just no longer printing logs.");
						console.trace("Where the 100th overridden call came from.")
						window.___stopLogs = true;
						try{
							${removeNonNativeWinProps}
						}catch (e){
							console.error("couldn't stop js execution", JSON.stringify(e));
						}
						console.log = ()=>{};
						// throw "[PScript STUB] Stop JS please";
					}
				`;
				// redefining document.write -- otherwise all event handlers (including ours) get removed
				w.eval(`
					document.write = (markup)=>{
						console.log("%c[PScript STUB] Preventing document.write, %s, markup: %s", "color:pink;", location.href, markup);
						${stopJsThrow}
					};
					document.writeln = (line)=>{
						console.log("%c[PScript STUB] Preventing document.writeln, %s, line: %s", "color:pink;", location.href, line);
						${stopJsThrow}
					};
					`);
				// redefining setInterval/Timeout to no-op -- hopefully animations stop.
				if(window !== window.top){
					// early.page.mods already re-define timeouts
					w.eval(`setInterval = () => {
						console.log("[PScript STUB] Page scripts trying to set an interval --> we've replaced it with no-op", window.location.href);
						${stopJsThrow};
						return 0;
					};`);
					w.eval(`setTimeout = () => {
						console.log("[PScript STUB] Page scripts trying to set a timeout --> we've replaced it with no-op", window.location.href);
						${stopJsThrow};
						return 0;
					};`);	
				}
				// Just element selection isn't enough -- we need to ensure XHRs don't 'grow' webpages after we screenshot them
				function stubPageF(className, fName, w, returnV = "null"){
					w.eval(`${className}.prototype.${fName} = ()=>{
						if(!window.___stopLogs){
							console.log("[PScript STUB]Page script tried to use an overwritten ${className} F, '${fName}', Doing nothing instead.", window.location.href);
						}
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
				domManipF2Disable.forEach(fName => stubPageF("HTMLElement", fName, w, (fName.indexOf("All") > -1)?"[]":"null"));
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
					const tmplt = `
						Object.defineProperty(CSS2Properties.prototype, "${propName}", {set(a){
							if(!window.___stopLogs){
								console.log("[PScript STUB] Not setting ${propName.toUpperCase()} style", (a || "undefined").toString());
							}
							${stopJsThrow}
							// console.stack();
							return "";
						}});
					`;
					w.eval(tmplt);
				};
				// NUCLEAR option -- disabling setters on all CSS2Properties
				const allCssProps2Disable = Object.keys(window.CSS2Properties.prototype); // window.__getAllCssPropList();
				//const allCssProps2Disable = ["left", "display", "opacity", "transform", "MozTransform", "webkitTransform", "WebkitTransform"]
				allCssProps2Disable.forEach(cssProp => {
					overwriteCSS2Prop(cssProp, w);
				});
				// Disabling in-built animations
				w.eval(`Element.prototype.animate = function(){console.log("[PScript STUB] Preventing built-in Animation: ", ...arguments)}`);
				// Preventing event Dispatching - no idea how to stop JS animations otherwise (they save a copy to setTimeout)
				w.eval(`EventTarget.prototype.dispatchEvent = function(e){console.log("[PScript STUB] Preventing an event: ", e.type, location.href)};`);
				// ensuring iframes can receive messages
				w.eval(`Event.prototype.stopImmediatePropagation = function(){console.log("%c[PScript STUB] Not calling stopImmediatePropagation", "background-color:#5A5A05;");}`);
				w.eval(`CSSStyleSheet.prototype.insertRule = function(){console.log("[PScript STUB] Not inserting rules", ...arguments)};`);
				w.eval(`XMLHttpRequest.prototype.send = function(){console.log("[PScript STUB] Not Sending a XMLHttpRequest", ...arguments)};`);
				
				w.eval(`window.stop();`);
			}
			window.dispatchEvent(new Event("StopEventHandling"));
		} catch (err) {
			console.error(err.toString(), "\nSTACK TRACE: ", err.stack, location.href);
		}
		console.log("Animation Freezing finished for", window.location.href);
		document.documentElement.dispatchEvent(new Event("UIFrozen"));
	};
	
	function overrideSetTimeout(){
		// because quite often they stop working - no idea why, or how content pages actually do that
		window.clearTimeout = ()=>console.error("[OVERRIDEs] We've overridden window.setTimeout -- we can't use clearTimeout anymore");
		window.setTimeout = (f, t, ...rest)=>{
			window._alarmPr(t).then(()=>{
				if(typeof f === "string"){
					eval(f);
				}else{
					f(...rest);
				}
			});
		};
		console.log("[OVERRIDEs] Replaced the local setTimeout with the backend one.");
	}
	
	function pauseVideoAudio(){
		const avEls = Array.from(document.querySelectorAll("video, audio"));
		if(avEls.length){
			console.log("Audio/video elements -- pausing them, n: ", avEls.length, location.href);
			avEls.forEach(el => {
				el.pause();
			});
		}
	}
	
	
	function _waitForAllImagesToLoadPr () {
		const allImgUrls = Array.from(document.querySelectorAll("img")).map(x=>(x.currentSrc || x.src));
		console.log("Images to load", allImgUrls.length, JSON.stringify(allImgUrls));
		return Promise.allSettled(allImgUrls.map(imgUrl=>{
			if(!imgUrl || imgUrl.indexOf("data:image/") > -1){
				// nothing to wait for to load 
				return Promise.reject("Empty or data:image/ URL, " + imgUrl);
			}
			// checking if valid url
			var urlObj;
			try{
				urlObj = new URL(imgUrl, document.location.href);
			}catch(e){
				// console.warn("[_waitForAllImagesToLoadPr] Not a valid URL:", imgUrl, location.href);
				return Promise.reject("Not a valid URL, " + imgUrl);
			}
			// checking if http
			if(urlObj.protocol !== "http:" && urlObj.protocol !== "https:"){
				// console.log(urlObj, urlObj.protocol, imgUrl);
				// console.warn("[_waitForAllImagesToLoadPr] : ", imgUrl, location.href);
				return Promise.reject("Img url not http, " + imgUrl);
			}
			// trying to load the image
			return new Promise(function(resolve, reject) {
				// else wait for the image to load
				const img = new Image();
				img.onerror = function (err) {
					// console.log("Error loading an image, ", imgUrl);
					reject(err + imgUrl);
				};
				img.onload = function (ev) {
					resolve();
				};
				img.setAttribute("src", imgUrl);
			});
		})).then(imgLoadResArr=>{
			imgLoadResArr = Array.from(imgLoadResArr);
			// console.log(JSON.stringify(imgLoadResArr));
			console.log("[_waitForAllImagesToLoadPr] Images loaded: ", imgLoadResArr.reduce((a, x)=>a = (a + (x.reason?0:1)), 0), "OUT of", imgLoadResArr.length);
			imgLoadResArr.forEach(x => {
				if(x.reason){
					console.warn("[_waitForAllImagesToLoadPr]" + x.reason);
				}
			});
		});
	};
	
	const _alarmPr = (duration)=>{
		// because Google Ads mess with window.setTimeout and it no longer fires -- I don't know how they do it, since page scripts are supposed to have a difference version of "window" (different from content scripts)
		return browser.runtime.sendMessage({
			"action": "timeout",
			"duration": duration
		});
	};
	
	// function _locAlarmPr(timeout){
	// 	return new Promise(function(resolve, reject) {
	// 		window.setTimeout(resolve, timeout);
	// 	});
	// }
	
	// Checking for Quirks mode and linking scrollingElement to documentElement if needed
	const getScrlEl = (()=>{
		// var scrlEl = window.getScrlEl();
		var scrlEl = "scrollingElement";
		getPageLoadedPr().then(()=>{
			if(window.top === window && location.href.indexOf("about:") > -1){
				return; // this is a default page -- no point checking
			}
			if(document.compatMode === "BackCompat"){
				if(!document[scrlEl]){
					console.log("[EARLY] %c Quirks mode detected with scrollingElement undefined." + window.location.href, "color:darkred;");
					scrlEl = "documentElement";
				}
				// scrlEl = scrlEl || document.documentElement;
			}
		});
		return ()=>{
			return document[scrlEl] || document.documentElement; // so it's always non-null
		};
	})();
	
	window.waitForAllImagesToLoadAsync = function(){
		// small timeout - otherwise many images aren't found for some reason
		return _alarmPr(100).then(_waitForAllImagesToLoadPr);
	};
	
	// window.stopMarqueeAsync = stopMarqueeAsync;
	window._alarmPr = _alarmPr;
	// window._locAlarmPr = _locAlarmPr;
	window.getScrlEl = getScrlEl;
	window.pauseVideoAudio = pauseVideoAudio;
	window.stopAllAnimations = stopAllAnimations;
	window.overrideSetTimeout = overrideSetTimeout;
	window.getPageLoadedPr = getPageLoadedPr;
})();
