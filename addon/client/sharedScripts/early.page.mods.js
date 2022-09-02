/* eslint-env browser */
// NOTE: ONLY Runs in the main frame

(()=>{
	// making sure timeouts/intervals aren't called with 0 delay -- freezes the main process
	// console.warn("[EARLY] Page mods running.");
	const w = window.wrappedJSObject;
	try{
		w.eval(`
			(()=>{
				var ___counterT = 0;
				window.___origSetTimeoutF = window.setTimeout;
				window.___origSetIntervalF = window.setInterval;
				window.setTimeout = function(f, t, ...args){
					if(isNaN(t)){
						t = 0;
					}
					t += 10;
					___counterT++;
					if(___counterT > 1000){
						console.log("Setting timeout, ", t);
					}
					return window.___origSetTimeoutF(f, t, ...args);
				};
				window.setInterval = function(f, t, ...args){
					if(isNaN(t)){
						t = 0;
					}
					t += 10;
					___counterT++;
					if(___counterT > 1000){
						console.log("Setting interval, ", t);
					}
					return window.___origSetIntervalF(f, t, ...args);
				}				
			})();
		`);
		// stop event dispatching to all listeners
		w.eval(`
			(()=>{
				var ___counterE = 0;
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
					if(f === null){
						return; // do nothing
					}
					if(f.handleEvent){ // a handler can be an object
						var self = f;
						f = f.handleEvent;
					}
					if(__fStore.has(f)){
						return; // simulating addEventListener not adding the same f
					}
					function wF(e){
						___counterE++;
						if(__pageScriptEventsAllowed){
							if(___counterE > 1000){ // so we don't pollute too much
								console.log("[PAGE_MODS] Handling event: %c" + t, "color: #A9C998;");
							}
							// checking if 'this' has been bound, so we don't have to do it
							if(f.name.startsWith("bound") && !f.hasOwnProperty("prototype")){
								f(e);
							}else{
								f.call(self || this, e);
							}
						}else{
							if(___counterE > 1000){ // so we don't pollute too much
								console.log("[PAGE_MODS] NOT handling page event: %c" + t, "color: #A9C998;");
							}
							console.log("[PAGE_MODS] NOT handling page event: %c" + t, "color: red;");
							if(e && e.stopImmediatePropagation){
								e.stopImmediatePropagation();
							}
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
