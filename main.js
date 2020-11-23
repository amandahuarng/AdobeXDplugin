/* Required Imports
uxp - gives us access to file system APIs
scenegraph - allows us to manipulate objects on artboard
application - allows us to instantiate batch edits on document
*/
const { ImageFill } = require("scenegraph");
const uxp = require("uxp");
const fs = uxp.storage.localFileSystem;
const { application, editDocument } = require("application");


/* 
    if a selection exists, it will invoke a default folder picker for user 
    to choose what directory they want to export their rendition as a PDF
    and performs export
*/
async function exportLogo(selection){
    if(selection.items.length > 0){
        
        // invoke default folder picker and creates logo.pdf
        const folder = await fs.getFolder();
        const file = await folder.createFile("logo.pdf");

        // data structure defining our settings 
        let renditionSettings = [{
            node: selection.items[0],               // [1] first user-selected item
            outputFile: file,                       // [2] set output file to file
            type: application.RenditionType.PDF,    // [3] set type property
            scale: 2                                // [4] set desired scale
        }];
        
        // createRenditions takes in renditionSettings and produces outputfile
        application.createRenditions(renditionSettings)    
            .then(results => {                             
                console.log(`Pdf rendition has been saved at ${results[0].outputFile.nativePath}`);
            })
            .catch(error => {                              
                console.log(error);
            });
    }
}

/*
    helper function that takes in a url/path and makes a XMLHttpRequest
    Returns response as a UInt8Array (png image --> arraybuffer representation)
*/
function xhrBinary(path) {                                      
    return new Promise((resolve, reject) => {                   
        const req = new XMLHttpRequest();                      
        req.onload = () => {
            if (req.status === 200) {
                try {
                    const arr = new Uint8Array(req.response);   
                    resolve(arr);                              
                } catch (err) {
                    reject(`Couldnt parse response. ${err.message}, ${req.response}`);
                }
            } else {
                reject(`Request had an error: ${req.status}`);
            }
        }
        req.onerror = reject;
        req.onabort = reject;
        req.open('GET', path, true);
        req.responseType = "arraybuffer";                       
        req.send();
    });
}

/*
    helper function that takes dataUri or File object and converts it to an ImageFill
    that we can then use as the fill property for a selection
*/
function applyImagefill(selection, file) {                             
    const imageFill = new ImageFill(file);                            
    selection.items[0].fill = imageFill;                               
}

let filepath = null;        // stores path to image file 

/*
    Panel() is invoked when the plugin is selected.
    It creates the HTML for the panel UI and has some important nested functions.
    Serves as the entrypoint to the app/plugin
*/
function panel(){
    let panel;
    const $ = sel => panel && panel.querySelector(sel);
    const html = `
<style>
    .break {
        flex-wrap: wrap;
    }
    label.row > span {
        color: #8E8E8E;
        width: 20px;
        text-align: right;
        font-size: 9px;
    }
    label.row input {
        flex: 1 1 auto;
    }
    label.options > span {
        color: #000000;
        width: 100%;
        text-align: center;
        font-size: 12px;
    }
    label.options {
        align-items: center;
    }
    form {
        width:90%;
        margin: -20px;
        padding: 0px;
    }
    .show {
        display: block;
    }
    .hide {
        display: none;
    }
</style>

<form method="dialog" id="main">
    <div class="row break">
        <label class="options">
            <span>Choose School</span>
            <select id="school-choice">
                <option value="cmc">Claremont McKenna College</option>
                <option value="scr">Scripps College</option>
                <option value="hmc">Harvey Mudd College</option>
                <option value="pom">Pomona College</option>
                <option value="pz">Pitzer College</option>
            </select>
        </label>
        <label class="row">
            <span>↕︎</span>
            <input type="number" uxp-quiet="true" id="txtV" value="10" placeholder="Height" />
        </label>
        <label class="row">
            <span>↔︎</span>
            <input type="number" uxp-quiet="true" id="txtH" value="10" placeholder="Width" />
        </label>
       
    </div>
    <footer><button id="ok" type="submit" uxp-variant="cta">Generate Logo</button></footer>
</form>

<p id="warning">This plugin requires you to select a rectangle in the document. Please select a rectangle.</p>
`;
    /*
        Helper function that is called whenever the button Generate Logo is clicked
    */
    function editSize() { 
        const height = Number($("#txtV").value);   
        const width = Number($("#txtH").value); 
        editDocument({ editLabel: "Place logo and edit size" }, async function (selection) {
            try {
                const photoUrl = filepath;
                const photoObj = await xhrBinary(photoUrl);   // convert img to arraybuffer
                const tempFolder = await fs.getTemporaryFolder();                          
                const tempFile = await tempFolder.createFile("tmp", { overwrite: true });  
                await tempFile.write(photoObj, { format: uxp.storage.formats.binary });  // write array to tempFile
                applyImagefill(selection, tempFile);    // use tempFile to fill the selection
            }       
            catch (err){
                console.log("error")
                console.log(err.message);
            }
            
            const selectedRectangle = selection.items[0]; // last selected item
            selectedRectangle.width += width;             // update height with user input
            selectedRectangle.height += height;           // update width with user input
        });
    }      
    /*
        Helper function that helps updating global variable filepath
    */
    function setSchool(path){
        filepath = path
    }

    /*
        Called once to create panel's DOM. There is also an on-change listener to detect
        any changes made to the selected value (school) -- at each update, it calls setSchool
    */
    function create(){
        if (panel){return panel;}
        panel = document.createElement("div"); 
        panel.innerHTML = html; 
        panel.querySelector("form").addEventListener("submit", editSize); 

        $("#school-choice").onchange = (event) => {
            if (event.target.value == "cmc") {
                filepath = './school-logos/logo-long/cmc.png';
                setSchool(filepath)
            }
            else if (event.target.value == "hmc") {
                filepath = './school-logos/logo-long/hmc.png';
                setSchool(filepath)
            }
            else if (event.target.value == "scr") {
                filepath = './school-logos/logo-long/scripps.png';
                setSchool(filepath)
            }
            else if (event.target.value == "pom") {
                filepath = './school-logos/logo-long/pomona.png';
                setSchool(filepath)
            }
            else if (event.target.value == "pz") {
                filepath = './school-logos/logo-long/pitzer.png';
                setSchool(filepath)
            }
        }
        return panel; 
    }

    /*
        Required function for panel plugins. Attaches the panel UI container
        from the create function to the event node
    */
    function show(event) { 
        if (!panel) event.node.appendChild(create()); 
    }

    /*
        Lifecycle function that is called whenever user selection within document changes
    */
    function update(selection) { // [1]
        const { Rectangle } = require("scenegraph"); // [2]

        const form = $("form"); // [3]
        const warning = $("#warning"); // [4]

        if (!selection || !(selection.items[0] instanceof Rectangle)) { // [5]
            form.className = "hide";
            warning.className = "show";
        } else {
            form.className = "show";
            warning.className = "hide";
        }
    }

    return {
        show, update
    }

}



module.exports = {
    commands: {
        exportLogo: exportLogo
    },
    panels:{
        createAndResizeLogo: panel()
    }
}