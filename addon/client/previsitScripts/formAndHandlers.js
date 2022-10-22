/* eslint-env browser */
/* global jQuery  */
/* global browser */

(function(){
	const MAX_PAGE_LENGTH = Math.pow(2, 13.5); // TODO: Move it to the settings.js file
	
	const formId = "id" + Math.round(Math.random() * 100000);
	const removePageBtnId = "id" + Math.round(Math.random() * 100000);
	const validatePageBtnId = "id" + Math.round(Math.random() * 100000);
	const restorePageBtnId = "id" + Math.round(Math.random() * 100000);
	const submitPageBtnId = "id" + Math.round(Math.random() * 100000);
	const draggableId = "drag"+ Math.round(Math.random() * 100000);
	const shadowWrapperId = "shadowDiv" + Math.round(Math.random() * 100000);
	const formContents = `
		<form  id="${formId}" action="#">
			<p id="${draggableId}" class="previsit-draggable-p">Script to modify this page; jQuery exits. Redirects are saved upon Send.</p>
			<textarea rows="6" cols="40" placeholder="Just paste Func body here... NOTE: 'Validate' detaches all DOM event handlers (e.g., for 'click')" class="previsit-textarea"></textarea>
			<div class="previsit-btn-wrap">
				<input type="button" class="" value="Validate" id="${validatePageBtnId}"/>
				<input id="${submitPageBtnId}" type="submit" class="" value="Send"/>
				<input type="button" class="" value="Remove Page" id="${removePageBtnId}"/>
				<input type="button" class="" value="Restore Page" id="${restorePageBtnId}"/>
			</div>
		</form>
	`;
	// const htmlForm = `<div id="${shadowWrapperId}" class="previsit-form"></div>`;
	
	class PrevisitForm extends HTMLElement{
		constructor(urlIdRef){
			super();
			this.id = shadowWrapperId;
			this.action = "#";
			this.classList.add("previsit-form");
			const shadow = this.attachShadow({mode: "open"});
			const st = document.createElement("style");
			st.setAttribute("rel", "stylesheet");
			fetch(browser.runtime.getURL("client/css/previsit.shadow.form.css"))
				.then(resp=>resp.text())
				.then(css=>{
					st.textContent = css;
				});
			shadow.appendChild(st);
			// using <template> to parse an HTML string
			const t = document.createElement("template");
			t.innerHTML = formContents.trim();
			shadow.appendChild(t.content);
			_renderWarnings(shadow);
			// TODO: Move event handlers here?...
			const formEl = shadow.getElementById(formId);
			attachSubmitHandler(formEl, urlIdRef);
			shadow.getElementById(validatePageBtnId).addEventListener("click", validateHandler);
			attachBanishHandler(shadow, urlIdRef);
			// shadow.getElementById(formId).submit();
			shadow.getElementById(restorePageBtnId).addEventListener("click", function (e) {
				e.preventDefault();
				_refreshF();
			});
			// Make the DIV element draggable:
			dragElement(shadow.host, formEl.querySelector("#" + draggableId));
		}
	}
	customElements.define("previsit-form", PrevisitForm);

	const _debug = true;
	
	// define a getter for the pageMod function
	const _getF = (rootFormEl)=>{
		const txtAreatxt = rootFormEl.querySelector("textarea").value;
		const pieces = txtAreatxt.split(";").map(s=>{
			if(s.indexOf("$$c") > -1){
				return s.replace("$$c", "document.querySelectorAll") + ".forEach(x=>x.click())";
			}else if(s.indexOf("$$r") > -1){
				return s.replace("$$r", "document.querySelectorAll") + ".forEach(x=>x.remove())";
			}
			return s;
		});
		const ft = pieces.join(";").replaceAll("$$", "document.querySelectorAll"); // handling console's native $$
		return new Function("$", "addCssF", ft);
	};

	function _renderWarnings(rootEl){
		const doc = window.getScrlEl();//window.getScrlEl() || document.documentElement;
		// general page length
		if(doc.scrollHeight > MAX_PAGE_LENGTH){
			renderWarning("Long Page: " + doc.scrollHeight + "px. Exclude?", rootEl);
		}
		// overflow wankiness
		if(document.scrollingElement.scrollWidth > window.innerWidth){
			renderWarning("[Ahtung] scrollWidth > innerWidth", rootEl);
		}
		if(document.scrollingElement.scrollHeight < window.innerHeight + 5){
			renderWarning("[Ahtung] scrollHeight same as innerHeight? If not, debug", rootEl);
		}
		if(document.querySelectorAll("frameset").length){
			window.alert("FRAMESET detected - nothing will work here. Dump this steaming pile-of-garbage page. It'll close automatically.");
			window.close();
		}
	}
	
	function renderWarning(msg, rootEl){
		rootEl.querySelector("#" + draggableId).insertAdjacentHTML("afterbegin", `<span class='previsit-warn'>${msg}</span>`);
	}
	
	
	function validateHandler(e){
		e.preventDefault();
		const f = _getF(this.closest("form"));
		_refreshF();
		window.setTimeout(function () {
			f($, window.CssInjector._injectStringCss);
			// a small delay - so we can see the effect of applying a function
		}, 500);
	}
	
	function attachBanishHandler(formEl, urlIdRef){
		formEl.querySelector("#" + removePageBtnId).addEventListener("click", function (e) {
			e.preventDefault();
			console.log("Asking to banish a page, UrlID:", urlIdRef.urlId);
			browser.runtime.sendMessage({
				"action": "banishPage",
				"urlId": urlIdRef.urlId
			}).then((respObj) => {
				console.log("Done banishing a page, ", respObj);
				// we are done here - emit Done event
				browser.runtime.sendMessage({
					"action": "doNextStep",
					urlId: urlIdRef.urlId
				});
			});
		});
	}
	
	function attachSubmitHandler (formEl, urlIdRef) {
		// package data and send it to the tab
		formEl.addEventListener("submit", (e)=>{
			e.preventDefault();
			const f = _getF(formEl);
			console.log("Asking to save a script: ", f.toString(), " UrlID:", urlIdRef.urlId);
			browser.runtime.sendMessage({
				"action": "savePrevisitF",
				f: f.toString().replace("anonymous", ""),
				"href": window.location.href,
				"urlId": urlIdRef.urlId
			}).then((respObj) => {
				console.log("Done saving a script, ", respObj);
				// we are done here - emit Done event
				browser.runtime.sendMessage({
					"action": "doNextStep",
					urlId: urlIdRef.urlId
				});
			});			
		});
	}
	
	const _refreshF = (()=>{
		var origBodyHtmlRef;
		return (origBodyHtml, refreshOnly = false)=>{
			if(!origBodyHtml){
				throw "We haven't recorded origBodyHtml -- can't refresh before that.";
			}else if(refreshOnly){
				origBodyHtmlRef = origBodyHtml;
			}else{
				document.body.querySelectorAll(":not(#" + shadowWrapperId + ")").forEach(x=>x.remove());
				document.body.insertAdjacentHTML("afterbegin", origBodyHtmlRef);				
			}
			// $("body").children(":not(#" + shadowWrapperId + ")").remove();
			// $("body").append(origBodyHtml);
		};
	})();
	
	// frequent shortcuts -- to minimize typing in FF console
	// window.$$c = (s)=>document.querySelectorAll(s).forEeach(x=>x.click());
	// window.$$r = (s)=>document.querySelectorAll(s).forEeach(x=>x.remove());
	const w = window.wrappedJSObject;
	w.eval("window.$$c = (s)=>document.querySelectorAll(s).forEach(x=>x.click());");
	w.eval("window.$$r = (s)=>document.querySelectorAll(s).forEach(x=>x.remove());");

	function renderFormAndAssignHandlers() {
		const _log = console.log;
		console.log = function () {
			return _debug ? _log("[CONTENT Script Previsit]", ...arguments) : undefined; // swallow log messages if not in debug - otherwise it's a bit too console polluting
		};
		const urlIdRef = {
			urlId: "NOT SET URL ID",
			tabId: "NOT SET TAB ID"
		};
		window.scrollTo(0, 0);
		const bodyClone = $("body").clone(); // Not doing removals on the original html, so we see all the effects at least once
		bodyClone.find("script").remove(); // so scripts dont get confused when re-run
		bodyClone.find("iframe").attr("src", "about:blank"); // so FB and AdSense don't go wild reloading
		bodyClone.find("iframe").html("");
		_refreshF(bodyClone.html(), true);
		// const origBodyHtml = bodyClone.html();
		
		

		// const _refreshF = () => {
		// 	$("body").children(":not(#" + shadowWrapperId + ")").remove();
		// 	$("body").append(origBodyHtml);
		// };
		// Add the form to the body
		// $(document.body).append(jqOurForm);
		// document.body.insertAdjacentHTML("beforeend", htmlForm);
		// const rootFormEl = document.getElementById(formId);
		const rootFormEl = new PrevisitForm(urlIdRef);
		document.body.appendChild(rootFormEl);

		
		// const jqOurForm = $(htmlForm);
		// _renderWarnings(rootFormEl.shadowRoot);
		// rootFormEl.shadowRoot.querySelector("#" + submitPageBtnId).addEventListener("click", (e)=>rootFormEl.submit());
		
		// rootFormEl.shadowRoot.querySelector("#" + validatePageBtnId).addEventListener("click", function (e) {
		// 	e.preventDefault();
		// 	// const txtAreatxt = $("#" + formId).find("textarea").val();
		// 	// const f = new Function("$", "addCssF", txtAreatxt);
		// 	const f = _getF();
		// 	_refreshF();
		// 	window.setTimeout(function () {
		// 		f($, window.CssInjector._injectStringCss);
		// 		// a small delay - so we can see the effect of applying a function
		// 	}, 500);
		// });
		// rootFormEl.submit();
		// rootFormEl.shadowRoot.querySelector("#" + removePageBtnId).addEventListener("click", function (e) {
		// 	e.preventDefault();
		// 	console.log("Asking to banish a page, UrlID:", urlId);
		// 	browser.runtime.sendMessage({
		// 		"action": "banishPage",
		// 		"urlId": urlId
		// 	}).then((respObj) => {
		// 		console.log("Done banishing a page, ", respObj);
		// 		// we are done here - emit Done event
		// 		browser.runtime.sendMessage({
		// 			"action": "doNextStep",
		// 			urlId: urlId
		// 		});
		// 	});
		// });

		// rootFormEl.shadowRoot.querySelector("#" + restorePageBtnId).addEventListener("click", function (e) {
		// 	e.preventDefault();
		// 	_refreshF();
		// });
		// // Make the DIV element draggable:
		// dragElement(rootFormEl, rootFormEl.shadowRoot.querySelector("#" + draggableId));
		// Ask for the set up data
		browser.runtime.sendMessage({
			"action": "giveMeTabId"
		}).then(function (respObj) {
			if (respObj.action !== "haveYourTabId") {
				throw new Error("Only Id related responses are welcome..."); // fool check
			}
			Object.assign(urlIdRef, respObj);
			// tabId = respObj.tabId;
			// urlId = respObj.urlId;
			console.log("Webpage loaded and got tab and url ids, ", respObj);
		});
	};

	function dragElement(dragWrapEl, dragAreaEl) {
		var pos1 = 0,
			pos2 = 0,
			pos3 = 0,
			pos4 = 0;
		dragAreaEl.onmousedown = dragMouseDown;

		function dragMouseDown(e) {
			e = e || window.event;
			e.preventDefault();
			// get the mouse cursor position at startup:
			pos3 = e.clientX;
			pos4 = e.clientY;
			document.onmouseup = closeDragElement;
			// call a function whenever the cursor moves:
			document.onmousemove = elementDrag;
		}

		function elementDrag(e) {
			e = e || window.event;
			e.preventDefault();
			// calculate the new cursor position:
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			// set the element's new position:
			dragWrapEl.style.top = (dragWrapEl.offsetTop - pos2) + "px";
			dragWrapEl.style.left = (dragWrapEl.offsetLeft - pos1) + "px";
		}

		function closeDragElement() {
			// stop moving when mouse button is released:
			document.onmouseup = null;
			document.onmousemove = null;
		}
	}

	window.renderFormAndAssignHandlers = renderFormAndAssignHandlers;
})();
