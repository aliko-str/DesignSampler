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
					window.scrollTo({left: 0, top: Math.ceil(window.scrollY + window.innerHeight), behavior: "instant"});
					console.log("Current scroll: ", window.scrollY, " Window height: ", window.getScrlEl().scrollHeight);
				}, 150 * i);
			}
			window.setTimeout(resolve, 150 * nSteps + 10);
		});
	}
	
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
		.then(scrollUpDown)
		.then(()=>window.waitForAllImagesToLoadAsync())
		.then(()=>{
			return window._alarmPr(1000); // a second for the new content to try to load
		})
		.then(()=>window.addonMain());

	window._scrollDownAsync = _scrollDownAsync;
	window._scrollTopAsync = _scrollTopAsync;
})();
