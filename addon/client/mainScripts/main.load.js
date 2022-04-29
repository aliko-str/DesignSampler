/* eslint-env browser */

(function () {
	console.log("Addon Content Script rolling: new.main.load.js");

	const scriptLoadedTimeout = 12000; // needs to be > delayFromScriptsToRun * 2 + scrollingTime
	const delayForScriptsToRun = 5500;
	const MAX_SCROLL_TOP_TIME = 3000; // because some pages continously firing "scroll" events that we use to know when scrollTop finished
	// var hasLoaded = false;
	
	function _scrollTopAsync(){
		// There isn't a scrollEnd event, and smooth scrolling takes time -- use the wacky solution below to detect the end of scrolling
		return new Promise(function(resolve, reject) {
			let timer, tStart, done = false;
			const scrollHandler = () => {
				window.clearTimeout(timer);
				timer = setTimeout( () => {
					console.log("%cDone scrolling to the top: " + (Date.now()-tStart) + "ms", "color:pink;");
					window.removeEventListener("scroll", scrollHandler);
					done = true;
					resolve();
				}, 150);
			};
			window.addEventListener('scroll', scrollHandler, { passive: true });
			tStart = Date.now();
			window.scrollTo({top: 0, left: 0, behavior: "smooth"}); // some pages use scrolling-based animations, and these don't reset unless scrolling is 'smooth'
			console.log("[SCROLL] To Top.");
			window.setTimeout(()=>{
				if(!done){
					console.log("[SCROLL] Timed-out before scrollTop finished -- probably page firing 'scroll' events manually");
					resolve();
				}
			}, MAX_SCROLL_TOP_TIME);
		});
	}
	
	function _scrollDownAsync(){
		return new Promise(function(resolve, reject) {
			const nSteps = Math.floor(window.getScrlEl().scrollHeight / window.innerHeight);
			for(let i = 1; i <= nSteps; i++){
				window.setTimeout(()=>{
					window.scrollTo({left: 0, top: window.scrollY + window.innerHeight, behavior: "instant"});
					console.log("Current scroll: ", window.scrollY, " Window height: ", window.getScrlEl().scrollHeight);
				}, 150 * i);
			}
			window.setTimeout(resolve, 150 * nSteps + 10);
		});
	}

	// var _hasRun = false;
	// 
	// function startWorkingOnPage() {
	// 	const _main = window.addonMain;
	// 	if (_hasRun) {
	// 		return;
	// 	}
	// 	_hasRun = true;
	// 	window.setTimeout(function () {
	// 		// This could probably be done from a Content Script -- no need for being a page script
	// 		Promise
	// 			.race([_scrollDownAsync().then(_scrollTopAsync), new Promise(function(resolve, reject) {
	// 				window.setTimeout(()=>{
	// 					reject("After double waiting period of scriptLoadedTimeout, " + scriptLoadedTimeout + "Not everything has loaded/fired ");
	// 				}, scriptLoadedTimeout);
	// 			})])
	// 			.catch(console.error)
	// 			.then(()=>{
	// 				_main();
	// 			});
	// 	}, delayFromScriptsToRun);
	// }
	
	function scrollUpDown(){
		// This could probably be done from a Content Script -- no need for being a page script
		return Promise
			.race([_scrollDownAsync().then(_scrollTopAsync), new Promise(function(resolve, reject) {
				window.setTimeout(()=>{
					reject("After double waiting period of scriptLoadedTimeout, " + scriptLoadedTimeout + "Not everything has loaded/fired ");
				}, scriptLoadedTimeout);
			})])
			.catch(console.error);
	}
	
	window
		.getPageLoadedPr(scriptLoadedTimeout, ()=>{
			console.warn("[IFRAME] Timed out on: " + window.location.href);
		})
		.then(()=>{
			return window._alarmPr(delayForScriptsToRun);
		})
		.then(()=>window.waitForAllImagesToLoadAsync())
		.then(scrollUpDown)
		.then(()=>window.addonMain());

	// if (document.readyState === "complete") {
	// 	window.waitForAllImagesToLoad(startWorkingOnPage);
	// } else {
	// 	window.addEventListener("load", x => window.waitForAllImagesToLoad(startWorkingOnPage));
	// }
	// // for the case when "load" is overwritten or fails to fire for any other reason
	// window.setTimeout(function () {
	// 	// NOTE: this part was intended to handle non-loading (infinite load) pages, but it no longer does - we inject this script at "document_end", which means after "load" ==> We should handle non-loads in br.main.js
	// 	if (!_hasRun) {
	// 		if (console && console.log) {
	// 			console.log("Timed out on: " + window.location.href);
	// 		}
	// 		// here we don't care if images haven't loaded fully yet -- too much to wait
	// 		startWorkingOnPage();
	// 	}
	// }, scriptLoadedTimeout);

	window._scrollDownAsync = _scrollDownAsync;
	window._scrollTopAsync = _scrollTopAsync;
})();
