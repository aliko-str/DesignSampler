/*eslint-env browser*/
// scripts to be applied to each webpage - to remove pop-ups, top/bottom bars etc.

(()=>{
	// TODO: Move these exceptions to an external file
	const noActionExceptions = ["crimsouneclub.com", "fabindia.com", "corneliajames.com", "saintandsofia.com", "www.rubynz.com", "www.ezliving-interiors.ie", "covethouse.eu", "homefurniture.ca", "international.univ-tours.fr", "ec-nantes.fr"]; // because some of the genericPageMods cause page re-load
	
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
		const gTranslEls = document.querySelectorAll(".goog-te-banner-frame.skiptranslate");
		if(gTranslEls.length){
			console.log("[PageMode] Removng Google translate iframe", location.href);
			gTranslEls.forEach(el => el.remove());
			document.body.style.top = "initial";
		}

		// Common alert banner x buttons
		const bannerCloseButtons = [".klaviyo-close-form", ".js-usp-close", ".modal-close", ".js-modal-close", ".fancybox-close-small", "[data-wps-popup-close]", ".wisepops-close", ".s-close-popup", ".close-modal", ".ui-dialog-titlebar-close", ".popup-close"];
		// Common cookieButtons to be clicked
		const cookieButtons2Click = ["#CybotCookiebotDialogBodyButtonDecline", "button.close", ".recommendation-modal__close-button", "#btn-cookie-allow", ".js-cookie-consent-close", ".cookie-banner-accept", ".cookie-accept-button", ".js-accept-gdpr", ".eg-cc-dismiss", "#inputAcceptCookies", ".cookie-notice__close"].concat(bannerCloseButtons).join(",");
		document.querySelectorAll(cookieButtons2Click).forEach(x=>x.click());
		// Common cookie-notice providers/messages
		const commonCookieContainerSelectors = ["#onetrust-banner-sdk", "#onetrust-consent-sdk", ".cc-window.cc-banner.cc-bottom", "#cookie-bar, #cookie-law-info-bar, #cookie-notice", ".cookie-policy.cookie-policy--open", "#__tealiumGDPRecModal", "#cookie_alert", "#js-cookie-banner", "#cookie_terms", "[data-role='gdpr-cookie-container']", "#ccc", "[id*='shopify-privacy-banner']", "#cookieNotification", "#cmplz-cookiebanner-container", "#adroll_consent_container", "#sliding-popup", ".cc_banner-wrapper", ".cookiebanner", "#cookie-notification"].join(",");
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
		// extra actions
		__animationRelatedMods();
		styleBasedPageMods();
		unfixBackgrounds();
		// removing a pixel img -- often causes an empty line at the bottom
		document.querySelectorAll("img[width='1'][height='1'], iframe[width='0'][height='0']").forEach(x=>x.remove());
		// hopefully innocent fixes for Firefox issues
		ffBugFixes();
	};
	
	function ffBugFixes(){
		document.body.querySelectorAll("*").forEach(el=>{
			const st = window.getComputedStyle(el);
			// this blend mode causes background images to be invisible on screenshots
			if(st["background-blend-mode"].includes("overlay")){
				console.log("[FF FIX] Unsetting background-blend-mode, ", el.tagName);
				el.style["background-blend-mode"] = "unset";
			}
		});
	}
	
	function __animationRelatedMods(){
		// some items become hidden while we move things around (due to our paused animations, they won't run, and stay invisible)
		document.querySelectorAll("#reamaze-widget").forEach(x=>x.style.animation="none");
	}
	
	function unfixBackgrounds(){
		// viewport-fixed background images are not displayed on full-page screenshots -- unfixing them summarily for all (instead of manually for each invidual webpage where I see it)
		const els2unfix = Array.from(document.body.querySelectorAll("*")).filter(x=>getComputedStyle(x)["background-attachment"] === "fixed");
		if(els2unfix.length){
			console.log("[UNFIX] $cAttached background images, n:, %i", "color:gray;", els2unfix.length);
			els2unfix.forEach(x=>x.style.setProperty("background-attachment", "initial", "important"));
		}
	}
	
	function __pageContextGenericMods(){
		__disableNiceScroll();
		_disablePawAnimate();
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
	
	function styleBasedPageMods(){
		// for cases of scripts showing notices with a delay
		const cookieAlers2HideSelectors = ["#adroll_consent_container"].join(",");
		window.CssInjector._injectStringCss(cookieAlers2HideSelectors, "display:none !important;");
	}
	
	function _disablePawAnimate(){
		const animatedEls = document.querySelectorAll("[paw-animate]");
		if(animatedEls.length){
			console.log("[PAGE_MODS] %cDisabling Paw-Animate for %s elements", "color:orange;", animatedEls.length);
			window.CssInjector._injectStringCss("[paw-animate]", "animation:none !important;opacity:1 !important;"); // using CSS because scripts often scroll-trigger some opacity changes for these elements
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
		const klScripts = Array.from(document.head.querySelectorAll("script")).filter(x=>x.src && x.src.indexOf("klaviyo.com") > -1);
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

