var myWebSocket;

// simple states
var isConnected = false;
var isModalOpen = false;
var isBusy = false;
var activeIndex = 0;
var queueCollection = [];
var statusCollection = [];

var COMFTY_URL = "http://127.0.0.1:8188";
var clientId = generateId(); //can be windows name

function initializeApp(){
    const queueList = localStorage.getItem("queueList");
    const statusList = localStorage.getItem("statusList");

    if(queueList){
        parsedQC = JSON.parse(queueList);

        parsedQC.forEach((item)=>{
            queueCollection.push(JSON.stringify(item, null, 2));
        })

        statusCollection = JSON.parse(statusList);
        console.log("statusList:",statusCollection);
        setNewActiveIndex();
        refreshList();
    };

    
}

// utils
function clearStorage(){
    localStorage.removeItem("queueList");
    localStorage.removeItem("statusList");
}

function generateId(){
    return 'xxxxxyxxxxxxxxxxxxyxxxxxxx'
    .replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, 
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}



function setNewActiveIndex(){
    setCurrentIndex(queueCollection.length);
}

function setCurrentIndex(ind){
    console.log("** activeIndex->",ind);
    activeIndex = ind;
}

function toggleConnection(con){
    isConnected = con;
    var cb = document.getElementById("connectBtnContainer");
    var fb = document.getElementById("footerBtn");
    if(isConnected){
        cb.innerHTML = `<button onclick="closeConn()" class="ml-1 right-5 inline-flex items-center text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-full text-center px-3 py-2 shadow-lg focus:outline-none focus-visible:ring-2">
        <svg class="w-3 h-3 fill-current text-red-300 flex-shrink-0 mr-2" height="16" width="12" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path d="M0 128C0 92.7 28.7 64 64 64H320c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128z"/></svg>
        <span>Disconnect</span>
    </button>`;
        fb.classList.remove("hidden");
    }else{
        cb.innerHTML = `<button onclick="connectToWS()" class="right-5 inline-flex items-center text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-full text-center px-3 py-2 shadow-lg focus:outline-none focus-visible:ring-2">
        <svg class="w-3 h-3 fill-current text-green-300 flex-shrink-0 mr-2" height="16" width="12" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path d="M96 0C78.3 0 64 14.3 64 32v96h64V32c0-17.7-14.3-32-32-32zM288 0c-17.7 0-32 14.3-32 32v96h64V32c0-17.7-14.3-32-32-32zM32 160c-17.7 0-32 14.3-32 32s14.3 32 32 32v32c0 77.4 55 142 128 156.8V480c0 17.7 14.3 32 32 32s32-14.3 32-32V412.8C297 398 352 333.4 352 256V224c17.7 0 32-14.3 32-32s-14.3-32-32-32H32z"/></svg>
        <span>Connect</span>
    </button>`;
        fb.classList.add("hidden");
    }
}

function connectToWS(){
    if (myWebSocket !== undefined) {
        myWebSocket.close()
    }

    myWebSocket = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);

    myWebSocket.onmessage = function(event) {
        var leng;
        if (event.data.size === undefined) {
            leng = event.data.length
        } else {
            leng = event.data.size
        }
        console.log("onmessage. size: " + leng + ", content: " + event.data);
        const message = JSON.parse(event.data);

        if(!isBusy){
            return;
        }

        if (message['type'] == 'progress'){
            const data = message['data']
            if(data['value'] && data['max']){
                statusCollection[activeIndex]['progress'] = parseInt(100*(Number(data['value'])/Number(data['max'])));
                refreshAll();
            }
        }else if (message['type'] == 'executed'){
            const data = message['data']
            if(data['output'] && data['output']['images'] && data['output']['images'][0] && data['output']['images'][0]['filename']){
               statusCollection[activeIndex]['output'] = `${COMFTY_URL}/view?filename=${data['output']['images'][0]['filename']}&subfolder=${data['output']['images'][0]['subfolder']}&type=${data['output']['images'][0]['type']}&rand=${Math.random()}`;
               refreshAll();
            }
        }else if (message['type'] == 'status'){
            const data = message['data']
            if(data['status'] && data['status']['exec_info'] && data['status']['exec_info']['queue_remaining'] == 0){
                
                //check next processing
                statusCollection[activeIndex]['progress'] = 100;
                setCurrentIndex(activeIndex+1);
                if(activeIndex < queueCollection.length){
                    queue_prompt();
                }else{
                    //Done with batch processing!
                    pauseQueues();
                }
            }
        }
    }

    myWebSocket.onopen = function(evt) {
        toggleConnection(true);
        console.log("onopen.");
    };

    myWebSocket.onclose = function(evt) {
        toggleConnection(false);
        console.log("onclose.");
    };

    myWebSocket.onerror = function(evt) {
        toggleConnection(false);
        console.error("Error!");
    };
}

function sendMsg() {
    var message = document.getElementById("myMessage").value;
    myWebSocket.send(message);
}

function closeConn() {
    myWebSocket.close();
}

// API request
async function queue_prompt(){

    let prompt = queueCollection[activeIndex];
    let payload = `{"client_id":"${clientId}", "prompt":${prompt}}`;
    const response = await fetch(COMFTY_URL+"/prompt", {
        method: "POST",
        mode: "cors", // no-cors, *cors, same-origin
        credentials: "same-origin", // include, *same-origin, omit
        headers: {"Content-Type": "application/json"},
        // referrerPolicy: "strict-origin-when-cross-origin", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-ur 
        body: payload, // body data type must match "Content-Type" header
      });
    const responseJson = await response.json();

    if(response['error']){
        //alert and pause
        pauseQueues();
    }

    statusCollection[activeIndex] = ({"progress":0,"promptId":responseJson['prompt_id'],"output":""});
    isBusy = true;
}

// modal control
function toggleModal(con){
    isModalOpen = con;
    var modal = document.getElementById("defaultModal");
    if(isModalOpen){
        modal.classList.remove('hidden');
    }else{
        modal.classList.add('hidden');
    }
}
function openModal(){
    toggleModal(true);
    let workflowTxtArea = document.getElementById("workflowTxtArea");
    let workflowTitle = document.getElementById("workflowTitle");

    if(activeIndex < queueCollection.length){
        workflowTxtArea.value = queueCollection[activeIndex];
        workflowTitle.innerHTML = `API Format Workflow - Queue No. ${activeIndex + 1}`;
    }else{
        workflowTxtArea.value = "";
        workflowTitle.innerHTML = `API Format Workflow - New Queue`;
    }
}

function closeModal(){
    toggleModal(false);
}

// prompt creation
function processPrompt(){
    queue_prompt(queueCollection[activeIndex])
}

// Queue list
function saveItem(){
    const activePrompt = document.getElementById("workflowTxtArea").value;
    
    if(!activePrompt){
        //error, don't close
    }

    closeModal();
    if(queueCollection.length == activeIndex){
        queueCollection.push(activePrompt);
        statusCollection.push({"progress":0,"promptId":"","output":""});    
    }else{
        queueCollection[activeIndex] = activePrompt;
    }

    refreshAll();
}

function removeItem(index){
    queueCollection.splice(index,1);
    statusCollection.splice(index,1);
    refreshAll();
}

function refreshAll(){
    refreshLocalStore();
    refreshList();
}

function refreshLocalStore(){
    let t1 = "["
    queueCollection.forEach((item,index)=>{
        if(index == (queueCollection.length-1)){
            t1 += `${item.toString()}`
        }else{
            t1 += `${item.toString()},`
        }
    })
    localStorage.setItem("queueList",`${t1}]`);

    //status list
    let t2 = "["
    statusCollection.forEach((item,index)=>{
        console.log(item);
        if(index == (queueCollection.length-1)){
            t2 += `${JSON.stringify(item)}`
        }else{
            t2 += `${JSON.stringify(item)},`
        }
    })
    localStorage.setItem("statusList",`${t2}]`);
    console.log(`-- saving ${t2}]`);
}

function refreshList(){
    let dom = ""

    if(isBusy){
        queueCollection.forEach((item,index)=>{
            dom += `<li class="flex p-6 border justify-between ${(index == activeIndex)?'border-lime-500 bg-lime-200': ((statusCollection[index]['output']=='') ? 'border-slate-200 border-slate-100':'border-lime-200 bg-lime-100') }">
            <div class="ml-4 flex items-center gap-4 flex-1">
                <h1 class="text-xl">Queue No. ${index + 1}</h1>
                <div class="grow w-4/5 bg-gray-300 rounded-full h-2.5">
                  <div class="bg-green-600 h-2.5 rounded-full" style="width: ${statusCollection[index]['progress']}%"></div>
                </div>
                <a class="${(statusCollection[index]['output']=='') ? 'hidden':''} inline-flex items-start mr-3" href="#0" onclick="displayImg('${statusCollection[index]['output']}')">
                     <svg class="w-10 h-10 text-green-100" height="10" width="10" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"/></svg>
                </a>
            </div>
            </li>`;
        });
    }else{
        queueCollection.forEach((item,index)=>{
            dom += `<li class="flex p-6 border justify-between ${(statusCollection[index]['output']=='') ? 'border-gray-200 bg-gray-100':'border-lime-200 bg-lime-100'}">
            <div class="ml-4 flex items-center gap-4 flex-1">
                <h1 class="text-xl" onclick="setCurrentIndex(${index});openModal();"><a href="#">Queue No. ${index + 1}</a></h1>
                <div class="grow w-3/5 bg-gray-300 rounded-full h-1.5">
                  <div class="bg-green-600 h-2.5 rounded-full" style="width: ${statusCollection[index]['progress']}%"></div>
                </div>
                <a class="${(statusCollection[index]['output']=='') ? 'hidden':''} inline-flex items-start mr-3" href="#0" onclick="displayImg('${statusCollection[index]['output']}')">
                     <svg class="w-10 h-10 text-green-100" height="10" width="10" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"/></svg>
                </a>
                <button onclick="removeItem(${index})" type="button" class="font-medium text-red-600 hover:text-red-500">Remove</button>
            </div>
            </li>`;
        });
    }    

    var container = document.getElementById("notifContainer");
    container.innerHTML = dom;
}

//Running Queues
function runQueues(){
    isBusy = true;
    setCurrentIndex(0);
    refreshList();
    queue_prompt();
}

function pauseQueues(){
    isBusy = false;
    setNewActiveIndex();
    refreshList();
}

function continueQueues(){
    isBusy = true;
    statusCollection.every((item,index)=>{
        if(item['progress'] < 100){
            setCurrentIndex(index);
            queue_prompt();
            return false;
        }
        return true;
    });    
}

//Image display
function closeImgModal(){
    const imgModal = document.getElementById("imgModal");
    imgModal.classList.add("hidden");
}

function displayImg(imgURL){
    const imgContainer = document.getElementById("imgContainer");
    imgContainer.innerHTML = `<img
                            alt="gallery"
                            class="block h-full w-full rounded-lg object-cover object-center"
                            src="${imgURL}" />`

    const imgModal = document.getElementById("imgModal");
    imgModal.classList.remove("hidden");
}