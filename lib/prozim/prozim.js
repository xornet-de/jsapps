/**
 * PROZIM WebApp 1.0
 * 
 * Stefan Beyer
 * 
 * GPL
 */
 
/**
 * IE braucht Sonderbehandlung für console.log 
 */
if(typeof console === "undefined") { var console = { log: function (logMsg) { } }; }
// if(!window.console) { var console = { log: function (logMsg) { } }; }

/**
 * Referenz der als nächstes ausgeführten Anweisung.
 */
var activeCommandLine = null;

/**
 * Handle für Intervall-Timer
 */
var AutoPlayTimer = null;

/**
 * Das Register-Objekt kümmert sich um alle
 * Register und Speicherplätze, sowie um die
 * Interpretation der Befehls-Parameter.
 * 
 * Also allgemein: Quelle und Ziele von Werten.
 * 
 * a,b,c,adr,pz sind als Register registriert.
 * #0, #2, ..., #<ramCount-1> sind die RAM-Speicherplätze.
 * 0, 77, -32 ... stehen je für  die Zahl selbst.
 * [adr] ist ein Spezialfall (siehe set()).
 * 
 * Getter und Setter interpretieren die Namen entsprechend.
 * 
 */
var Register = {
	
	/// Die Bekannten Register
	regNames: ["a","b","c","adr","pz"],
	
	/// Anzahl der zulässigen Speicherplätze (#0,#1, ...)
	ramCount:26,
	
	/**
	 * Analysiert n und setzt den entsprechenden
	 * Speicherplatz oder das Register auf den Wert v.
	 * set("2", 6) macht demnach keinen Sinn.
	 * 
	 * Auch wird ein visueller Effekt für das gesetzte Register
	 * erzeugt.
	 */
	set: function(n, v) {
		n = n.toLowerCase(); /// Nur in Kleinbuchstaben arbeiten
		
		/// [adr] muss gesondert behandelt werden
		/// Der Speicherplatz, dessen nummer im adr-Register
		/// steht wird gesetzt.
		if (n == "[adr]") {
			Register.set("#"+Register.get("adr"), v);
			return;
		}
		
		/// Falls eine Raute vorangestellt ist, handelt es sich
		/// um einen Speicherplatz
		if ((n[0] == '#')) {
			n = n.substr(1);  /// Raute vorne entfernen
			n = parseInt(n); /// Adresse auslesen
			/// keine gültige Adresse? log-Meldung.
			if (n >= Register.ramCount) {
				console.log("RAM["+n+"] gibt es nicht.");
				return;
			}
		}
		else {
			// TODO: prüfen ob ein register angesprochen wird.
			// falls nicht: eine zahl kann nicht gesetzt werden
			// log meldung und return.
		}
		
		/// Attribut des Objektes mit dem Schlüssel n
		/// wird gesetzt.
		/// this[0]...this[ramCount-1] sind die Speicherplätze;
		/// this["a"] ... die Register.
		this[n] = v;
		
		/// Falls pz-Register gesetzt wurde: Aktive Anweisung
		/// setzen.
		if (n=="pz") {
			setActiveCommandLine(v);
		}
		
		/// Visuelle Auswirkung
		$("#REG_"+n).html(v); /// Wert in Element setzen
		$("#REG_"+n).addClass("changed"); /// Effekt anstoßen
		setTimeout(function(){
			$("#REG_"+n).removeClass("changed");
		}, 300);
		
	}, // set()
	
	/**
	 * Analysiert n und gibt den entsprechenden
	 * Speicherplatz- oder das Register-Wert zurück.
	 */
	get: function(n) {
		n = n.toLowerCase(); /// Nur in Kleinbuchstaben arbeiten
		
		/// [adr] muss gesondert behandelt werden
		/// Der Speicherplatz, dessen nummer im adr-Register
		/// steht wird abgerufen.
		if (n=="[adr]") {
			return Register.get("#"+Register.get("adr"));
		}
		
		/// Speicherplatz- und Register-Werte sind als Objekt-
		/// Attribute gespeichert und werden hier geholt
		if ((n[0] == '#') || ($.inArray(n, Register.regNames)>-1)) {
			if ((n[0] == '#')) {
				n = n.substr(1); /// Raute entfernen
				n = parseInt(n); /// Adresse auslesen
				/// Falls außerhalb des Speicherbereiches: log.
				if (n >= Register.ramCount) {
					console.log("RAM["+n+"] gibt es nicht.");
					return 0;
				}
			}
			/// 
			return this[n];
		}
		
		/// In diesem Fall geht man davon aus, dass eine statische
		/// Zahl angegeben war und ermittelt den Wert.
		return parseInt(n);
		
	}, // get()
	
	/**
	 * Hier werden sowohl Register, als auch Speicherplätze
	 * erzeugt (der nötige HTML- und js-Krams).
	 */
	init: function() {
		// Register
		$.each(Register.regNames, function(k,v){
			$("#RegContainer").append("<span class=\"Reg\">"+v.toUpperCase()+"<span id=\"REG_"+v+"\"></span></span>");
			Register.set(v, 0);
		});
		
		// Ram
		for (var i=0; i<Register.ramCount; i++) {
			$("#RamContainer").append("<span class=\"Ram\">#"+i+"<span class=\"regedit\" id=\"REG_"+i+"\"></span></span>");
			$("#REG_"+i).prop("regname", "#"+i);
			Register.set("#"+i, 0);
		}
		// Ram editierbar
		$(".regedit").editable(
			/// Wert nach dem Bearbeiten wieder setzen
			function(value, settings) { 
				var v = parseInt(value);
				if (v == Number.NaN) v = 0;
				Register.set($(this).prop("regname"), v);
				return(""+v);
			}, { 
			 tooltip   : 'Klicken zum Bearbeiten ...',
			 data: function(value, settings) { /// Aktuellen Wert zum Editieren holen
				 return ""+Register.get($(this).prop("regname"));
			 }
		});

	} // Register.init()
}; // Register {}


/**
 * Überprüft ob LocalStorage verfügbar ist.
 */
function supports_html5_storage() {
  try {
    return 'localStorage' in window && window['localStorage'] !== null;
  } catch (e) {
    return false;
  }
}


/**
 * Erzeugt Html-Klimbim für einen Befehl
 * ist nur cl gegeben, so wird der Behfehl
 * gesplittet.
 */
function _getCommandLineHtml(cl, p1,p2) {
	if ((p1 == undefined)  && (p2 == undefined)) {
		var teile = cl.split(" ");
		cl = teile[0];
		p1 = (teile.length>1) ? teile[1] : "";
		p2 = (teile.length>2) ? teile[2] : "";
	}
	
	/// Class name wird erzeugt für das Anweisungs-Symbol
	var cls = $.trim(cl);
	cls = cls.replace(/\(-\)/, "_neg");
	cls = cls.replace(/\(0\)/, "_zero");
	
	var ret = "<span class=\"pointer\">&gt;</span>";
	ret += "<div class=\"command "+cls+"\">"+$.trim(cl)+"</div>"
	if (p1 != "") {
		ret += "<div class=\"param p1\">"+$.trim(p1)+"</div>";
		if (p2 != "") ret += "<div class=\"param p2\">"+$.trim(p2)+"</div>";
	}
	return ret;
} // _getCommandLineHtml()

/**
 * Einfügen-Element, das zwischen den Anweisungen
 * eingefügt wird wird erzeugt und zurückgegeben
 */
function createInsertItem(cls) {
	var insli = document.createElement("li");
	var insa = document.createElement("a");
	$(insli).append(insa);
	
	// insert bereich
	$(insa).html("+");
	$(insli).addClass("InsertItem");
	if (cls != undefined) $(insli).addClass(cls);
	$(insa).click(function(e) {
		var _new = addCommandLine("", $(this).parent());
		save();
		setTimeout(function() {
			$(_new).children(".CommandLineContent").click();
		}, 100);
	});
	
	return insli;
} // createInsertItem()


/**
 * Hinzufügen einer Anweisung (optional: before)
 */
function addCommandLine(c, before) {
	/*
	 *  ----------------------------
	 *            INS
	 *  ----------------------------
	 *  ---------------------------- 
	 * 
	 * 	>  CMD    P1   P2     DEL
	 * 
	 *  ----------------------------
	 * 
	 */
	var li = document.createElement("li");
	var dela = document.createElement("a");
	var cldiv = document.createElement("div");
	
	var insli = createInsertItem();
	
	if (before == undefined) {
		before = $("#CommandList ul li.last");
	}
	before.before(insli);
	before.before(li);
	
	// lösch knopf
	$(dela).html("x");
	$(dela).addClass("DeleteItem");
	$(dela).click(function(e) {
		e.preventDefault();
		//this); // a
		//e); // event
		// this.parent.before löschen
		$(this).parent().prev().remove();
		$(this).parent().remove();
		save();
	});
	
	$(li).prop('commandLine', c);
	$(li).addClass("CommandItem");
	
	$(cldiv).html(_getCommandLineHtml(c));
	
	$(li).append(cldiv);
	$(li).append(dela);
	
	$(cldiv).addClass("CommandLineContent");
	$(cldiv).editable(function(value, settings) { 
		 $(this).parent().prop("commandLine", value);
		 save();
		 return(_getCommandLineHtml(value));
	  }, { 
		 cancel    : 'Abbrechen',
		 submit  : 'Okay',
		 indicator : 'Änderungen übernehmen ...',
		 tooltip   : 'Klicken zum Bearbeiten ...',
		 data: function(value, settings) {
			 return $(this).parent().prop('commandLine');
		 }
	});
	
	return li;
}


/**
 * Setzt den als nächstes ausgeführten Befehl
 * (wird von Register.set("pz", ...) aufgerufen.)
 */
function setActiveCommandLine(n) {
	var clItems = $("#CommandList ul li.CommandItem");
	
	if (activeCommandLine && $(activeCommandLine).hasClass("active")) {
		$(activeCommandLine).removeClass("active");
		activeCommandLine = null;
		//console.log("acl null");
	}
	if ((clItems.length > 0) && (n < clItems.length)) {
		activeCommandLine = $(clItems[n]);
		activeCommandLine.focus();
		activeCommandLine.addClass("active");
		//console.log("acl "+n);
	}
}


/**
 * Erzeugt ein Array von Strings mit allen derzeit vorhandenen Anweisungen.
 */
function getProgramObject() {
	var a = [];
	$("#CommandList ul li.CommandItem").each(function(i,e) {
		var cl = $(e).prop("commandLine");
		a.push(cl);
	});
	return a;
}


function save(fn) {
	if (supports_html5_storage()) {
		try {
			if (fn) {
				localStorage.setItem(fn, JSON.stringify(getProgramObject()));
			}
			localStorage.setItem(".prozim_program", JSON.stringify(getProgramObject()));
		} catch (e) {
			
		}
	}
	updateFreeMemory();
}

function open(fn) {
	if (supports_html5_storage()) {
		try {
			if (fn) {
				load(localStorage.getItem(fn));
				return;
			}
			load(localStorage.getItem(".prozim_program"));
			return;
		} catch (e) {
			
		}
	}
}

function clearProgram() {
	activeCommandLine = null;
	$("#CommandList ul li:not(.last)").remove();
}


function load(a) {
	try {
		if (a[0] == "[") {
			a = $.parseJSON(a);
		} else {
			a = a.split("\n");
		}
		clearProgram();
		for (var i in a) {
			addCommandLine(a[i]);
		}
		save();
	} catch (e) {
		
	}
}

function getLocalFilelist() {
	var a = [];
	if (localStorage) {
		for (var f in localStorage) {
			if ( typeof localStorage[f] !== "string") continue;
			if (f[0] == '.') continue;
			a.push(f);
		}
	}
	return a;
}


/**
 * Eine Anweisung wird ausgeführt.
 */
function execute(cli) {
	/// Visueller Effekt
	cli.addClass("running");
	
	var code = $(cli).prop("commandLine");
	//console.log("exec:"+code);
	var teile = code.split(" ");
	cl = $.trim(teile[0]);
	p1 = $.trim((teile.length>1) ? teile[1] : "");
	p2 = $.trim((teile.length>2) ? teile[2] : "");
	
	var NextAdr = true; /// Geht es automatisch zum nächsten Befehl?
	
	switch (cl) {
		case "lade":
			Register.set("a", Register.get(p1));
		break;
		case "schreibe":
			Register.set(p1, Register.get("a"));
		break;
		case "add":
			Register.set("a", Register.get("a") + Register.get(p1));
		break;
		case "sub":
			Register.set("a", Register.get("a") - Register.get(p1));
		break;
		
		case "zu":
			Register.set("pz", Register.get(p1));
			NextAdr = false;
		break;
		case "springe":
			Register.set("pz", Register.get("pz") + Register.get(p1));
			NextAdr = false;
		break;
		
		case "zu(0)":
			if (Register.get("a") == 0) {
				Register.set("pz", Register.get(p1));
				NextAdr = false;
			}
		break;
		case "springe(0)":
			if (Register.get("a") == 0) {
				Register.set("pz", Register.get("pz") + Register.get(p1));
				NextAdr = false;
			}
		break;

		case "zu(-)":
			if (Register.get("a") < 0) {
				Register.set("pz", Register.get(p1));
				NextAdr = false;
			}
		break;
		case "springe(-)":
			if (Register.get("a") < 0) {
				Register.set("pz", Register.get("pz") + Register.get(p1));
				NextAdr = false;
			}
		break;

		case "stopp":
		case "stop":
		case "halt":
			NextAdr = false;
		break;
		
		
	}
	
	if (NextAdr) {
		Register.set("pz", Register.get("pz")+1);
	}
	
	/// Visuellen Effekt nach kurzer Zeit entfernen
	setTimeout(function() {
		cli.removeClass("running");
	}, 200);
}












/**
 * Wird durch onReady (jquery) aufgerufen.
 * Richtet alle UI-Elemente ein.
 */
function init() {
	//localStorage.clear();
	//console.log(localStorage);
	
	initDialogs();
	
	
	$( "#FileOpen" ).button({disabled:false});
	$( "#FileOpen" ).click(function(ui) {
		$( "#opendialog ul.filelist" ).empty();
		var filelist = getLocalFilelist();
		for (var f in filelist) {
			$( "#opendialog ul.filelist" ).append("<li><a>"+filelist[f]+"</a></li>");
		}
		$( "#opendialog ul.filelist" ).menu("refresh");
		$( "#opendialog" ).dialog( "open" );
	});
	
	$( "#FileSave" ).button({disabled:false});
	$( "#FileSave" ).click(function(ui) {
		$( "#savedialog ul.filelist" ).empty();
		var filelist = getLocalFilelist();
		for (var f in filelist) {
			$( "#savedialog ul.filelist" ).append("<li><a>"+filelist[f]+"</a></li>");
		}
		$( "#savedialog ul.filelist" ).menu("refresh");
		$( "#savedialog" ).dialog( "open" );
	});
	$( "#FileJson" ).button();
	$( "#FileJson" ).click(function(ui) {
		$("#jsondialog").dialog("open");
		// JSON.stringify(getProgramObject())
		var prm = "";
		var pobj = getProgramObject();
		for (var i in pobj) {
			prm += pobj[i]+"\n";
		}
		$("#jsondialog div.dialogcontent").html("<p>Programm-Code:</p><textarea class=\"ui-corner-all\" style=\"width:100%; height:100px;\">"+$.trim(prm)+"</textarea>");
	});
	
	$( "#Hilfe" ).button();
	$( "#Hilfe" ).click(function(ui) {
		$("#helpdialog").dialog("open");
	});

	
	$( "#ButtonStep" ).button();
	$( "#ButtonStep" ).click(function(ui) {
		if (!activeCommandLine) Register.set("pz", 0);
		if (activeCommandLine) execute(activeCommandLine);
	});
	
	$("#CheckRun").prop( "checked", false );
	$( "#CheckRun" ).button({disabled:false});
	$( "#CheckRun" ).click(function(ui) {
		if ($(this).is(":checked")) {
			if (AutoPlayTimer == null) {
				AutoPlayTimer = setInterval(
				function() {
					$( "#ButtonStep" ).click();
					if (activeCommandLine == null) {
						clearInterval(AutoPlayTimer);
						AutoPlayTimer = null;
						$("#CheckRun").prop( "checked", false );
						$("#CheckRun").button( "refresh" );
					}
				}, 1000
				);
			}
		} else {
			if (AutoPlayTimer != null) {
				clearInterval(AutoPlayTimer);
				AutoPlayTimer = null;
			}
		}
	});
	
	$( "#ButtonReset" ).button();
	$( "#ButtonReset" ).click(
		function(ui) {
			Register.set("pz", 0);
		}
	);
	
	$( "#ButtonClear" ).button();
	$( "#ButtonClear" ).click(
		function(ui) {
			clearProgram();
			save();
		}
	);
	
	
	var insli = createInsertItem("last");
	$("#CommandList ul").append(insli);

	
	open();
	
	Register.init();
	
	//updateFreeMemory();
	
	/// Robo wird derzeit nicht verwendet
	//jo = $("#roboCanvas");
	//setInterval(drawRobo, 300);
	
	//$("#helpdialog").dialog("open");
} // init


/// Robo wird derzeit nicht verwendet
var pos = {x:0, y:0};
var d = {x:0.7071,y:0.7071};
var jo;

/// Robo wird derzeit nicht verwendet
function drawRobo() {
	var speed = Register.get("#8");
	
	var w = (Register.get("#9") / 180) * Math.PI;
	d.x = Math.cos(w);
	d.y = Math.sin(w);
	
	pos.x += d.x * (speed/2);
	pos.y += d.y * (speed/2);
	
	jo.clearCanvas()
	.drawArc({
	  fillStyle: "#83C121",
	  x: 150+pos.x, y: 150+pos.y,
	  radius: 10
	});
}

/**
 * Dialogfenster werden initialisiert
 */
function initDialogs() {
	$( "#jsondialog" ).dialog({
		autoOpen: false,
		modal: true,
		width: 600,
		buttons: [
			{
				text: "Programm einlesen",
				click: function() {
					load($( this ).find( "textarea" ).val());
					$( this ).dialog( "close" );
				}
			},
			{
				text: "Schließen",
				click: function() {
					$( this ).dialog( "close" );
				}
			}
		]
	});
	
	$( "#savedialog ul.filelist" ).menu();
	$( "#savedialog ul.filelist" ).on( "menuselect", function( event, ui ) {
		$("#savedialog input.filename").val(ui.item.text());
	} );
	$( "#savedialog" ).dialog({
		autoOpen: false,
		modal: true,
		width: 400,
		buttons: [
			{
				text: "Speichern",
				click: function() {
					var fn = $("#savedialog input.filename").val();
					if (fn) {
						save(fn);
						$( this ).dialog( "close" );
					} else {
						alert("Name angeben!");
					}
				}
			},
			{
				text: "Abbrechen",
				click: function() {
					$( this ).dialog( "close" );
				}
			}
		]
	});
	
	
	
	$( "#opendialog ul.filelist" ).menu();
	$( "#opendialog ul.filelist" ).on( "menuselect", function( event, ui ) {
		$("#opendialog input.filename").val(ui.item.text());
	} );
	$( "#opendialog" ).dialog({
		autoOpen: false,
		modal: true,
		width: 400,
		buttons: [
			{
				text: "Öffnen",
				click: function() {
					var fn = $("#opendialog input.filename").val();
					if (fn) {
						open(fn);
						$( this ).dialog( "close" );
					} else {
						alert("Name wählen!");
					}
				}
			},
			{
				text: "Abbrechen",
				click: function() {
					$( this ).dialog( "close" );
				}
			}
		]
	});
	

	$( "#robodialog" ).dialog({
		autoOpen: false,
		modal: false,
		width: 300,
		height:300,
		buttons: [
			{
				text: "Schließen",
				click: function() {
					$( this ).dialog( "close" );
				}
			}
		]
	});
	
	
	
	$( "#helpdialog" ).dialog({
		autoOpen: true,
		modal: false,
		width: 500,
		height:400,
		buttons: [
			{
				text: "Schließen",
				click: function() {
					$( this ).dialog( "close" );
				}
			}
		]
	});
} // initDialogs

/// Wird nicht genutzt
function updateFreeMemory() {
	// nur IE
	/*if (supports_html5_storage()) {
		$("#freememory").text(localStorage.remainingSpace+" B");
	} else {
		$("#freememory").text("0 B");
	}*/
}