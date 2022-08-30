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
			return loadDonePr
				// .then(()=>{
				// 	if(location.href.indexOf("about:srcdoc") > -1){
				// 		console.warn("[SRCDOC] In Client Script, after loadDonePr", location.href);
				// 	}
				// })
				.then(window.recordNoStylingCssAsync) // moving here cause we don't want these in Previsiting
				.then(window.stopAllAnimations)
				.then(window.overrideSetTimeout)
				.then(()=>{
					return Promise.resolve({
						"action": "IFrameLoaded",
						"url": window.location.href
					});
				});	
		}
	});
	
	const loadDonePr = window
		.getPageLoadedPr(scriptLoadedTimeout * 2, ()=>{
			console.warn("[IFRAME] Timed out on: " + window.location.href);
		})
		.then(()=>{
			return window.unwrapShadowDomAsync(false);
		})
		.then(()=>{
			return window._alarmPr(delayForScriptsToRun);
		})
		.then(window.waitForAllImagesToLoadAsync);

})();

