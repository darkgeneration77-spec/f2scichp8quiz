(function(){
  const DEFAULT_API_URL = "https://YOUR-WORKER-URL.workers.dev";

  function apiUrl(){
    return (localStorage.getItem("ch8_api_url") || DEFAULT_API_URL).replace(/\/$/,"");
  }

  function student(){
    return {
      student_code: localStorage.getItem("ch8_student_code") || "",
      student_name: localStorage.getItem("ch8_student_name") || "Student",
      class_name: localStorage.getItem("ch8_class_name") || ""
    };
  }

  async function submit(payload){
    const url = apiUrl();
    if(!url || url.includes("YOUR-WORKER-URL")){
      console.warn("Chapter 8 API URL not configured. Result kept locally only.");
      localStorage.setItem("ch8_pending_"+Date.now(), JSON.stringify(payload));
      return {ok:false, pending:true};
    }
    try{
      const r = await fetch(url + "/api/submit-result", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error || "Upload failed");
      return d;
    }catch(err){
      console.error("Result upload failed:", err);
      localStorage.setItem("ch8_pending_"+Date.now(), JSON.stringify(payload));
      return {ok:false, pending:true, error:String(err)};
    }
  }

  async function retryPending(){
    const keys = Object.keys(localStorage).filter(k=>k.startsWith("ch8_pending_"));
    for(const k of keys){
      try{
        const payload = JSON.parse(localStorage.getItem(k));
        const d = await submit(payload);
        if(d && d.ok) localStorage.removeItem(k);
      }catch(e){}
    }
  }

  window.CH8Performance = {
    apiUrl, student, submit, retryPending,
    saveIdentity(code,name,className){
      if(code) localStorage.setItem("ch8_student_code", code.trim());
      if(name) localStorage.setItem("ch8_student_name", name.trim());
      if(className!==undefined) localStorage.setItem("ch8_class_name", (className||"").trim());
    }
  };

  window.addEventListener("online", retryPending);
})();