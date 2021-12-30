/* eslint-env browser */
/* global jQuery  */
/* global browser */

(function(){
	const MAX_PAGE_LENGTH = Math.pow(2, 14); // TODO: Move it to the settings.js file
	
	const formId = Math.round(Math.random() * 100000);
	const removePageBtnId = Math.round(Math.random() * 100000);
	const validatePageBtnId = Math.round(Math.random() * 100000);
	const restorePageBtnId = Math.round(Math.random() * 100000);
	const draggableId = "drag"+ Math.round(Math.random() * 100000);
	const htmlForm = `
	<form id="${formId}" action="#" class="previsit-form">
		<p id="${draggableId}" class="previsit-draggable-p">Script to modify this page; jQuery exits. Redirects are saved upon Send.</p>
		<textarea rows="6" cols="40" placeholder="Just paste Func body here... NOTE: 'Validate' detaches all DOM event handlers (e.g., for 'click')" class=" previsit-textarea"></textarea>
		<div class="previsit-btn-wrap">
			<input type="button" class="" value="Validate" id="${validatePageBtnId}"/>
			<input type="submit" class="" value="Send"/>
			<input type="button" class="" value="Remove Page" id="${removePageBtnId}"/>
			<input type="button" class="" value="Restore Page" id="${restorePageBtnId}"/>
		</div>
	</form>
	`;

	const _debug = true;

	function _renderWarnings(jqRoot){
		const warnEl = "<span class='previsit-warn'></span>";
		const doc = window.getScrlEl();//window.getScrlEl() || document.documentElement;
		if(doc.scrollHeight > MAX_PAGE_LENGTH){
			const tooLongWarning = $(warnEl);
			tooLongWarning.text("Long Page: " + doc.scrollHeight + "px. Exclude?");
			jqRoot.find("#" + draggableId).prepend(tooLongWarning);
		}
		if(document.querySelectorAll("frameset").length){
			window.alert("FRAMESET detected - nothing will work here. Dump this steaming pile-of-garbage page. It'll close automatically.");
			window.close();
			// const framesetWarn = "<span class='previsit-warn'>FRAMESET detected - dump the page!</span>";
			// jqRoot.find("#" + draggableId).prepend(framesetWarn);
		}
	}

	function renderFormAndAssignHandlers() {
		const _log = console.log;
		console.log = function () {
			return _debug ? _log("[CONTENT Script Previsit]", ...arguments) : undefined; // swallow log messages if not in debug - otherwise it's a bit too console polluting
		};

		var urlId = "NOT SET URL ID";
		var tabId = "NOT SET TAB ID";
		if (!jQuery) {
			throw new Error("We'd want jQuery loaded");
		}
		window.scrollTo(0, 0);
		const bodyClone = $("body").clone(); // Not doing removals on the original html, so we see all the effects at least once
		bodyClone.find("script").remove(); // so scripts dont get confused when re-run
		bodyClone.find("iframe").attr("src", "about:blank"); // so FB and AdSense don't go wild reloading
		bodyClone.find("iframe").html("");
		const origBodyHtml = bodyClone.html();

		const _refreshF = () => {
			$("body").children(":not(#" + formId + ")").remove();
			$("body").append(origBodyHtml);
		};
		const _getF = ()=>{
			const txtAreatxt = $("#" + formId).find("textarea").val().replaceAll("$$", "document.querySelectorAll");
			return new Function("$", "addCssF", txtAreatxt);
		};
		const jqOurForm = $(htmlForm);
		_renderWarnings(jqOurForm);
		jqOurForm.find("#" + validatePageBtnId).click(function (e) {
			e.preventDefault();
			// const txtAreatxt = $("#" + formId).find("textarea").val();
			// const f = new Function("$", "addCssF", txtAreatxt);
			const f = _getF();
			_refreshF();
			window.setTimeout(function () {
				f($, window.CssInjector._injectStringCss);
				// a small delay - so we can see the effect of applying a function
			}, 500);
		});
		jqOurForm.submit(function (e) {
			// package data and send it to the tab
			e.preventDefault();
			const f = _getF();
			console.log("Asking to save a script: ", f.toString(), " UrlID:", urlId);
			browser.runtime.sendMessage({
				"action": "savePrevisitF",
				f: f.toString().replace("anonymous", ""),
				"href": window.location.href,
				"urlId": urlId
			}).then((respObj) => {
				console.log("Done saving a script, ", respObj);
				// we are done here - emit Done event
				browser.runtime.sendMessage({
					"action": "doNextStep",
					urlId: urlId
				});
			});
		});
		jqOurForm.find("#" + removePageBtnId).click(function (e) {
			e.preventDefault();
			console.log("Asking to banish a page, UrlID:", urlId);
			browser.runtime.sendMessage({
				"action": "banishPage",
				"urlId": urlId
			}).then((respObj) => {
				console.log("Done banishing a page, ", respObj);
				// we are done here - emit Done event
				browser.runtime.sendMessage({
					"action": "doNextStep",
					urlId: urlId
				});
			});
		});

		jqOurForm.find("#" + restorePageBtnId).click(function (e) {
			e.preventDefault();
			_refreshF();
		});
		// Add the form to the body
		$(document.body).append(jqOurForm);
		// Make the DIV element draggable:
		dragElement(jqOurForm[0], document.getElementById(draggableId));
		// Ask for the set up data
		browser.runtime.sendMessage({
			"action": "giveMeTabId"
		}).then(function (respObj) {
			if (respObj.action !== "haveYourTabId") {
				throw new Error("Only Id related responses are welcome..."); // fool check
			}
			tabId = respObj.tabId;
			urlId = respObj.urlId;
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
