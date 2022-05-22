/*eslint-env browser*/
// scripts to be applied to each webpage - to remove pop-ups, top/bottom bars etc.

(()=>{
	const noActionExceptions = ["crimsouneclub.com", "fabindia.com", "corneliajames.com", "saintandsofia.com"]; // because some of the genericPageMods cause page re-load
	
	function __ssGenericPageMod(){
		if(noActionExceptions.some(x=>window.location.href.indexOf(x) > -1)){
			console.log("SKIPPING Rolling generic page mods");
			return; // no action exception
		}
		console.log("Rolling generic page mods");
		// removing FF out of date top bars
		document.querySelectorAll("#buorg.buorg").forEach(el => {
			console.log("[pageMod] Generic FF-outdated element removed.", location.href);
			el.remove();
			document.documentElement.style["margin-top"] = "initial";
		});
		// google translate banners
		document.querySelectorAll(".goog-te-banner-frame.skiptranslate").forEach(el => {
			console.log("[PageMode] Removng Google translate iframe", location.href);
			el.remove();
		});
		// Common alert banner x buttons
		const bannerCloseButtons = [".klaviyo-close-form", ".js-usp-close", ".modal-close", ".js-modal-close", ".fancybox-close-small", "[data-wps-popup-close]", ".wisepops-close", ".s-close-popup", ".close-modal", ".ui-dialog-titlebar-close"];
		// Common cookieButtons to be clicked
		const cookieButtons2Click = ["#CybotCookiebotDialogBodyButtonDecline", "button.close", ".recommendation-modal__close-button", "#btn-cookie-allow", ".js-cookie-consent-close", ".cookie-banner-accept", ".cookie-accept-button", ".js-accept-gdpr", ".eg-cc-dismiss", "#inputAcceptCookies", ".cookie-notice__close"].concat(bannerCloseButtons).join(",");
		document.querySelectorAll(cookieButtons2Click).forEach(x=>x.click());
		// Common cookie-notice providers/messages
		const commonCookieContainerSelectors = ["#onetrust-banner-sdk", "#onetrust-consent-sdk", ".cc-window.cc-banner.cc-bottom", "#cookie-bar, #cookie-law-info-bar, #cookie-notice", ".cookie-policy.cookie-policy--open", "#__tealiumGDPRecModal", "#cookie_alert"].join(",");
		document.querySelectorAll(commonCookieContainerSelectors).forEach(el=>el.remove());
		// Generic Overlays
		const commonOverlaySelectors = [".pum-overlay", ".overlay_11", "#boxpopup0", "#boxpopup1", "#boxpopup2", "#boxpopup3", "#boxpopup", ".md-overlay", "#myModal", ".modal-backdrop", "#shopify-section-popup", '#onesignal-slidedown-container'];
		document.querySelectorAll(commonOverlaySelectors).forEach(el=>el.remove());
		const commonNoScrollClasses = ["pum-open-overlay", "modal-open"];
		commonNoScrollClasses.forEach(c => {
			document.documentElement.classList.remove(c);
			document.body.classList.remove(c);
		});
		// Overlays with style-fixed overflows on body/html
		const fixedBodySels = ["#attentive_overlay"].join(",");
		const fixedBodyEls = document.querySelectorAll(fixedBodySels);
		if(fixedBodyEls){
			fixedBodyEls.forEach(x => x.remove());
			document.documentElement.style = document.body.style = null;
		}
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
		const jqLib = w.$ || w.jQuery;
		if(jqLib && jqLib.nicescroll){
			console.warn("[GEN PAGE MODs] Issue: niceScroll detected --> Removing it", location.href);
			try{
				jqLib(w.document.documentElement).niceScroll().remove(); // We can no longer use selectors because we've disabled them <-- Maybe I should only keep manipulations disabled
			}catch(e){
				console.error("niceScroll error", e);
			}
		}
	}
	
	window.__pageContextGenericMods = __pageContextGenericMods;

	window.__ssGenericPageMod = __ssGenericPageMod;	
})();

