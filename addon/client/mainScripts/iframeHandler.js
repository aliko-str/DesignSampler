/* eslint-env browser */
/* global browser */

// NOTE: We check here, and not in webNavigation.onComplete to account for cases when a script loads/renders everything --> that's also why we wait for delayForScriptsToRun ms

(function () {
	// avoid running for the main window
	if(window.top === window){
		// console.log("Avoiding running iframeHandler.js in the main window");
		return;
	}
	// console.log("Running iframeHandler.js in a frame: ", window.location.href);

	const scriptLoadedTimeout = 6000;
	const delayForScriptsToRun = 5000;
	
	browser.runtime.onMessage.addListener((msg)=>{
		if(msg.action === "haveYouLoaded_iframe"){
			return loadDonePr.then((_hasRun)=>{
				return Promise.resolve({
					"action": "IFrameLoaded",
					"url": window.location.href,
					"_hasRun": _hasRun
				});
			});	
		}
	});
	
	const loadDonePr = window
		.getPageLoadedPr(scriptLoadedTimeout * 2, ()=>{
			console.warn("[IFRAME] Timed out on: " + window.location.href);
		})
		.then(()=>{
			return window._alarmPr(delayForScriptsToRun);
		})
		.then(window.waitForAllImagesToLoadAsync)
		.then(window.stopAllAnimations);

	// const loadDonePr = new Promise((resolve, reject)=>{
	// 	var _hasRun = false;
	// 	function startWorkingOnPage() {
	// 		if (_hasRun) {
	// 			return;
	// 		}
	// 		_hasRun = true;
	// 		window.setTimeout(function () {
	// 			window.waitForAllImagesToLoad(function () {
	// 				try {
	// 					window.stopAllAnimations();
	// 				} catch (err) {
	// 					console.error(err);
	// 				}
	// 				resolve(_hasRun);
	// 			});
	// 		}, delayForScriptsToRun);
	// 	}
	// 	// Wait for the document to load
	// 	if (document.readyState === "complete") {
	// 		// console.warn('[IFRAME] Already complete', location.href);
	// 		startWorkingOnPage();
	// 	} else {
	// 		window.addEventListener("load", startWorkingOnPage);
	// 		// console.warn('[IFRAME] Waiting for load event', location.href);
	// 	}
	// 	// for the case when "load" is overwritten or fails to fire for any other reason <-- NEW: it can't be overwritten anymore - X-Ray for Content SCripts
	// 	window._alarmPr(scriptLoadedTimeout * 2).then(()=>{
	// 		// console.warn("[IFRAME] Timeout has rung", location.href);
	// 		if (!_hasRun) {
	// 			console.warn("[IFRAME] Timed out on: " + window.location.href);
	// 			// if for whatever reason haven't loaded or failed, we simply proceed to come back to the BG script
	// 			try {
	// 				window.stopAllAnimations();
	// 			} catch (err) {
	// 				console.error(err);
	// 			}
	// 			resolve(false);
	// 		}
	// 	});
	// });

})();

