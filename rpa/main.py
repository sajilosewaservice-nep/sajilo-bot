from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class RpaRequest(BaseModel):
    form_type: str  # pan | nid | passport | license | pcc
    data: dict      # payload for the form

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/run")
async def run_rpa(req: RpaRequest):
    # Semi-automation: placeholder implementation
    # In production, use Playwright to navigate and fill forms.
    # On Vercel, running browsers is limited; deploy this service on a persistent host.
    if req.form_type not in {"pan", "nid", "passport", "license", "pcc"}:
        raise HTTPException(status_code=400, detail="Invalid form_type")

    # TODO: implement Playwright automation scripts per form_type
    return {"queued": True, "form_type": req.form_type, "received": req.data}
