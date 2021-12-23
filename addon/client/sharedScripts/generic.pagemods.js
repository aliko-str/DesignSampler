/*eslint-env browser*/
// scripts to be applied to each webpage - to remove pop-ups, top/bottom bars etc.

(()=>{
	function __ssGenericPageMod(){
		console.log("Rolling generic page mods");
		// removing FF out of date top bars
		document.querySelectorAll("#buorg.buorg").forEach(el => {
			console.log("[pageMod] Generic element removed.", location.href);
			el.remove();
		});
		// google translate banners
		document.querySelectorAll(".goog-te-banner-frame.skiptranslate").forEach(el => {
			console.log("[PageMode] Removng Google translate iframe", location.href);
			el.remove();
		});
		// Common cookie-notice providers/messages
		const commonCookieContainerSelectors = ["#onetrust-banner-sdk", "#onetrust-consent-sdk", ".cc-window.cc-banner.cc-bottom", "#cookie-bar, #cookie-law-info-bar, #cookie-notice", ".cookie-policy.cookie-policy--open", "#__tealiumGDPRecModal"].join(",");
		document.querySelectorAll(commonCookieContainerSelectors).forEach(el=>el.remove());
		// Generic Overlays
		const commonOverlaySelectors = [".pum-overlay", ".overlay_11", "#boxpopup0", "#boxpopup1", "#boxpopup2", "#boxpopup3", "#boxpopup", ".md-overlay"];
		document.querySelectorAll(commonOverlaySelectors).forEach(el=>el.remove());
		const commonNoScrollClasses = ["pum-open-overlay"];
		commonNoScrollClasses.forEach(c => {
			document.documentElement.classList.remove(c);
			document.body.classList.remove(c);
		});
		// Removing scroll-dependent hiding methods -- For common Libs
		const aosSliders = document.querySelectorAll("[data-aos]");
		if(aosSliders.length){
			console.log("[PAGEMode] Removing data-aos fade sliding things.");
			aosSliders.forEach(el => el.removeAttribute("data-aos"));
		}
	};
	
	function __pageContextGenericMods(){
		// should run before we unbind/redefine native functions to stop animations/transitions
		// Some other things that I couldn't figure out how to dea with
		// Jquery nicescroll -- no idea how they do scrolling - not with css for sure
		const w = window.wrappedJSObject;
		if(w.$ && w.$.nicescroll){
			console.warn("[GEN PAGE MODs] Issue: niceScroll detected --> Removing it", location.href);
			try{
				w.$(w.document.documentElement).niceScroll().remove(); // We can no longer use selectors because we've disabled them <-- Maybe I should only keep manipulations disabled
			}catch(e){
				console.error("niceScroll error", e);
			}
		}
	}
	
	window.__pageContextGenericMods = __pageContextGenericMods;

	window.__ssGenericPageMod = __ssGenericPageMod;	
})();

