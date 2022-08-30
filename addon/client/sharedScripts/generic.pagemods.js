/*eslint-env browser*/
// scripts to be applied to each webpage - to remove pop-ups, top/bottom bars etc.

(()=>{
	// TODO: Move these exceptions to an external file
	const noActionExceptions = ["crimsouneclub.com", "fabindia.com", "corneliajames.com", "saintandsofia.com", "www.rubynz.com", "www.ezliving-interiors.ie", "covethouse.eu", "homefurniture.ca"]; // because some of the genericPageMods cause page re-load
	
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
		const bannerCloseButtons = [".klaviyo-close-form", ".js-usp-close", ".modal-close", ".js-modal-close", ".fancybox-close-small", "[data-wps-popup-close]", ".wisepops-close", ".s-close-popup", ".close-modal", ".ui-dialog-titlebar-close", ".popup-close"];
		// Common cookieButtons to be clicked
		const cookieButtons2Click = ["#CybotCookiebotDialogBodyButtonDecline", "button.close", ".recommendation-modal__close-button", "#btn-cookie-allow", ".js-cookie-consent-close", ".cookie-banner-accept", ".cookie-accept-button", ".js-accept-gdpr", ".eg-cc-dismiss", "#inputAcceptCookies", ".cookie-notice__close"].concat(bannerCloseButtons).join(",");
		document.querySelectorAll(cookieButtons2Click).forEach(x=>x.click());
		// Common cookie-notice providers/messages
		const commonCookieContainerSelectors = ["#onetrust-banner-sdk", "#onetrust-consent-sdk", ".cc-window.cc-banner.cc-bottom", "#cookie-bar, #cookie-law-info-bar, #cookie-notice", ".cookie-policy.cookie-policy--open", "#__tealiumGDPRecModal", "#cookie_alert", "#js-cookie-banner", "#cookie_terms", "[data-role='gdpr-cookie-container']", "#ccc", "[id*='shopify-privacy-banner']", "#cookieNotification", "#cmplz-cookiebanner-container"].join(",");
		document.querySelectorAll(commonCookieContainerSelectors).forEach(el=>el.remove());
		// Generic Overlays
		const commonOverlaySelectors = [".pum-overlay", ".overlay_11", "#boxpopup0", "#boxpopup1", "#boxpopup2", "#boxpopup3", "#boxpopup", ".md-overlay", "#myModal", ".modal-backdrop", "#shopify-section-popup", '#onesignal-slidedown-container', "#pa-push-notification-subscription", ".fancybox-wrap", ".fancybox-overlay"];
		document.querySelectorAll(commonOverlaySelectors).forEach(el=>el.remove());
		const commonNoScrollClasses = ["pum-open-overlay", "modal-open"];
		commonNoScrollClasses.forEach(c => {
			document.documentElement.classList.remove(c);
			document.body.classList.remove(c);
		});
		// KLaviyo bs popups -- common for eCommerce
		__handleKlaviyo();
		// .forEach(x=>x.parentElement.style.display = "none");
		// Overlays with style-fixed overflows on body/html
		const fixedBodySels = ["#attentive_overlay"].join(",");
		const fixedBodyEls = document.querySelectorAll(fixedBodySels);
		if(fixedBodyEls.length){
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
		__disableNiceScroll();
		// __handleScrollReveal();
	}
	
	function __disableNiceScroll(){
		// should run before we unbind/redefine native functions to stop animations/transitions
		// Some other things that I couldn't figure out how to dea with
		// Jquery nicescroll -- no idea how they do scrolling - not with css for sure
		const w = window.wrappedJSObject;
		const jqLib = w.$ || w.jQuery;
		if(jqLib && jqLib.nicescroll){
			console.warn("[GEN PAGE MODs] Issue: niceScroll detected --> Removing it", location.href);
			try{
				jqLib(w.document.documentElement).niceScroll().remove(); // We can no longer use selectors because we've disabled them <-- Maybe I should only keep manipulations disabled
				// some extras -- not sure it's needed for all, but certainly for some pages
				const s = document.documentElement.style;
				if(s && s.overflowX === "auto"){ // NOTE: because having overflow: auto visible makes both overflows auto <-- which hides overflow sometimes
					s.overflowX = "initial";
				}
			}catch(e){
				console.error("niceScroll error", e);
			}
		}
	}
	
	function preAnyChangePageMods(){
		__handleScrollReveal();
	}
	
	function __handleScrollReveal(){
		const w = window.wrappedJSObject;
		if(w.ScrollReveal){
			const _sr = w.ScrollReveal();
			if(_sr.destroy){
				return _sr.destroy();// newer versions
			}else if(w.sr && w.sr.store){
				// we're lucky to have guessed the name of the reference - as in the example from github
				w.sr.store.elements = {};
			}else{
				w.eval(`ScrollReveal().tools.__proto__.forOwn = function(){console.log("calling overridden forOwn for ScrollReveal");}`);
			}
			document.querySelectorAll("[data-sr-id]").forEach(el=>{
				el.style = null;
				el.removeAttribute("data-sr-id");
			});
			console.log("[ScrollReveal] Cleaned.");
		}
	}
	
	function __handleKlaviyo(){
		// const klaviyo = document.querySelectorAll("[class*='kl-private-reset-css'][role='dialog']");
		// if(klaviyo.length){
		// 	klaviyo[0].parentElement.id = klaviyo[0].parentElement.id || "klavioIsCrap" + Math.round(Math.random()*100);
		// 	window.CssInjector._injectStringCss("#" + klaviyo[0].parentElement.id, "display: none !important;");
		// 	console.log("%c[PAGEModes] Cleaned KLaviyo", "color:gray;");
		// 	// window.CssInjector._injectStringCss("[class*='kl-private-reset-css']:has([class*='kl-private-reset-css'][role='dialog'])", "display: none !important;");
		// }
		const klScripts = Array.from(document.head.querySelectorAll("script")).filter(x=>x.src && x.src.indexOf("klaviyo.js") > -1);
		if(klScripts.length){
			// console.log("[GEN PAGE MODs] Klaviyo Detected. Launching a Mutation Observer");
			window.CssInjector._injectStringCss("[class*='kl-private-reset-css']", "display: none !important;");
			console.log("%c[PAGEModes] Cleaned KLaviyo", "color:gray;");
		}
	}
	
	window.__pageContextGenericMods = __pageContextGenericMods;
	window.preAnyChangePageMods = preAnyChangePageMods;

	window.__ssGenericPageMod = __ssGenericPageMod;	
})();

