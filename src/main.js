import plugin from '../plugin.json';
import style from './style.scss';

const fsOperation = acode.require("fsOperation");
const select = acode.require("select");

class SQLBrowser {
    #worker = null;
    $tableArr = [];

    async init($page) {
        $page.id = "acode-plugin-sql";
        $page.settitle("SQL Browser");
        this.$page = $page
        editorManager.on("switch-file",this.run.bind(this));
        this.$style = tag('style',{
            textContent: style,
        });
        document.head.append(this.$style);
        this.createUi();
        this.$tablesList.onclick = this.openSelect.bind(this);
        this.pagination.onchange=this.paginate.bind(this)
        const onhide = this.$page.onhide;
        this.$page.onhide = () => {
            this.$tablesList.textContent="Select db table";
            this.$dbTable.innerHTML = "";
            this.#worker = null;
            this.$tableArr =[];
            //this.$page.innerHTML = "";
        }
        onhide();
    }
    
    async createUi(){
        this.$tablesList = tag("button",{
            className: "tablesList",
            textContent: "Select db table"
        });
        const table_container = tag("div",{
            className: "table_container",
        });
        this.$dbTable = tag("table",{
            className: "dbTable",
        });
        this.pagination = tag("input",{
            className: "pagination",
            type: "text",
            value: "0,30",
            placeholder: "Enter limit of rows(for eg: 0,30)"
        });
        this.$page.append(...[this.$tablesList,this.pagination,table_container]);
        table_container.append(this.$dbTable);
    }
    
    async run(file){
        if (!file.location || !/\.(db|sqlite3|sqlite)$/.test(file.name)) return;
        
        this.startWorker(this.baseUrl)
        const arrayBuffer = await fsOperation(file.location+file.name).readFile();
        this.openDB(arrayBuffer);
        await this.executeSQL("SELECT * FROM sqlite_master","list");
        this.$page.show()
    }
    
    async startWorker(baseUrl){
        this.#worker = new Worker(baseUrl+"lib/worker.sql-wasm.js");
        this.#worker.onerror = e => window.toast(`Worker error: ${e.message}`, 4000);
    }
    
    async openDB(arrayBuffer){
        this.#worker.postMessage({
            action: "open",
            buffer: arrayBuffer,
        });
    }
    
    async executeSQL(command,type){
        this.#worker.onmessage = (e) => {
            if (e.data.id=="list") {
                this.$tableArr=e.data.results[0].values;
            }else{
                this.createTable(e.data.results)
            }
        }
        this.#worker.postMessage({
            id:type,
            action: "exec",
            sql: command
        });
    }
    
    
    async loadPage() {
        let paginationArr = this.pagination.value.split(",");
        await this.executeSQL(`SELECT * FROM ${this.$tablesList.textContent} LIMIT ${paginationArr[0]}, ${paginationArr[1]}`,"table");
    }
    
    async createTable(res){
        this.$dbTable.innerHTML = "";
        if (res.length==0) {
            this.$dbTable.innerHTML="<tbody>No data ...</tbody>";
        }
        const thead = tag("thead");
        const headerRow = tag("tr");
        for (const col of res[0].columns) {
            const th = tag("th",{
                textContent:col,
            });
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow)
        this.$dbTable.appendChild(thead);
        // Add the table rows
        const tbody = tag("tbody");
        for (const row of res[0].values) {
            const tr = tag("tr");
            for (const cell of row) {
                const td = tag("td",{
                    textContent: cell,
                });
                tr.appendChild(td);
            }
            tbody.appendChild(tr)
            this.$dbTable.appendChild(tbody);
        }
    }
    
    async openSelect(){
        const newArray = [];
        for(let i=0;i<this.$tableArr.length;i++){
            newArray.push(this.$tableArr[i][2])
        }
        const tblSelect = await select("Select Table",newArray);
        if(!tblSelect) return;
        this.$tablesList.textContent=tblSelect;
        this.loadPage();
    }
    
    async paginate(){
        if (!this.pagination.value) {
            window.toast("Please enter limit!",3000);
        }
        let paginationArr = this.pagination.value.split(",");
        if (!paginationArr[0] || !paginationArr[1]) {
            window.toast("Please enter limit in right format, for eg: 0,30",3000)
        }
        this.loadPage();
    }
    
    async destroy() {
        editorManager.off("switch-file",this.run());
    }
}

if (window.acode) {
    const acodePlugin = new SQLBrowser();
    acode.setPluginInit(plugin.id, (baseUrl, $page, {
        cacheFileUrl, cacheFile
    }) => {
        if (!baseUrl.endsWith('/')) {
            baseUrl += '/';
        }
        acodePlugin.baseUrl = baseUrl;
        acodePlugin.init($page, cacheFile, cacheFileUrl);
    });
    acode.setPluginUnmount(plugin.id, () => {
        acodePlugin.destroy();
    });
}