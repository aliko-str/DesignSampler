/* eslint-env browser */
// NOTE: ONLY Runs in the main frame

(()=>{
	// making sure timeouts/intervals aren't called with 0 delay -- freezes the main process
	// console.warn("[EARLY] Page mods running.");
	const w = window.wrappedJSObject;
	try{
		w.eval(`
			window.___origSetTimeoutF = window.setTimeout;
			window.___origSetIntervalF = window.setInterval;
			window.setTimeout = function(f, t, ...args){
				if(isNaN(t)){
					t = 0;
				}
				t += 10;
				// console.log("Setting timeout, ", t);
				return window.___origSetTimeoutF(f, t, ...args);
			};
			window.setInterval = function(f, t, ...args){
				if(isNaN(t)){
					t = 0;
				}
				t += 10;
				// console.log("Setting interval, ", t);
				return window.___origSetIntervalF(f, t, ...args);
			}
		`);
		// stop event dispatching to all listeners
		w.eval(`
			(()=>{
				// A flag to check for disabling page's event handlers
				// console.log("DISABLING EVENTS", location.href);
				var __pageScriptEventsAllowed = true;
				window.addEventListener("StopEventHandling", ()=>{
					__pageScriptEventsAllowed = false;
					// console.log("StopEventHandling handled", location.href);
				}, {once: false, passive: true});
				window.addEventListener("StartEventHandling", ()=>{
					__pageScriptEventsAllowed = true;
					// console.log("StartEventHandling handled", location.href);
				}, {once: false, passive: true});
				// Storage for real/replaced event handlers <-- so the page can 'removeEventListener' correctly
				const __fStore = new Map();
				// Redefining add/removeEventListener
				const __realAddEventListener = EventTarget.prototype.addEventListener;
				const __realRemoveEventListener = EventTarget.prototype.removeEventListener;
				EventTarget.prototype.addEventListener = function(t, f, opt){
					function wF(e){
						if(__pageScriptEventsAllowed){
							// console.log("[PAGE_MODS] Handling event: %c" + t, "color: #A9C998;");
							// checking if 'this' has been bound, so we don't have to do it
							if(f.name.startsWith("bound") && !f.hasOwnProperty("prototype")){
								f(e);
							}else{
								f.call(this, e);
							}
						}else{
							console.log("[PAGE_MODS] NOT handling page event: %c" + t, "color: #A9C998;");
						}
					}
					__fStore.set(f, wF);
					__realAddEventListener.call(this, t, wF, opt);
				}
				EventTarget.prototype.removeEventListener = function(t, f, opt){
					__realRemoveEventListener.call(this, t, __fStore.get(f), opt);
				}
			})();
		`);
	}catch(e){
		console.error(e);
	}
})();
