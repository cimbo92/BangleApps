function screenCenter()
{
  return { x: g.getWidth() / 2, y: g.getHeight() / 2};
}

class Heart {
  constructor(position, size){
    this.position = position;
    this.size = size;
    this.originalSize = size;

    this.setHRMService();
  }

  drawLeftEllipse(){
      g.fillEllipse(this.position.x - (this.size / 2), this.position.y - this.size * 0.35,
                    this.position.x, this.position.y +  this.size * 0.15);
  }

  drawRightEllipse(){
      g.fillEllipse(this.position.x, this.position.y - this.size * 0.35,
                    this.position.x + (this.size / 2), this.position.y + this.size * 0.15);
  }

  drawPoly(){
      g.fillPoly([this.position.x - this.size * 0.43, this.position.y + this.size * 0.07, 
                  this.position.x - this.size * 0.08, this.position.y - this.size * 0.28,
                  this.position.x, this.position.y - this.size * 0.20,
                  this.position.x + this.size * 0.08, this.position.y - this.size * 0.28,
                  this.position.x + this.size * 0.43, this.position.y + this.size * 0.07,
                  this.position.x, this.position.y + this.size * 0.5]);
  }
  
  dismiss(){
    Bangle.setHRMPower(0);
  }
    

  draw(){
    heart.drawPoly(); // Bottom part of the heart
    heart.drawLeftEllipse(); // Top Left part of the heart
    heart.drawRightEllipse(); //Top Right part of the heart
  }

  setHRMService(){
    NRF.setServices({
      0x180D: { // heart_rate
        0x2A37: { // heart_rate_measurement
        value : [0x06, 0],
        maxLen : 32,
        notify: true
        }
      }
    }, { advertise: [ '180D' ] });

    //start tracking and notify bpm variations
    this.startTrackingHRM();
  }

  startTrackingHRM(){
    Bangle.setHRMPower(1);
    Bangle.on('HRM',function(hrm) {
      /*hrm is an object containing:
        { "bpm": number,             // Beats per minute
          "confidence": number,      // 0-100 percentage confidence in the heart rate
          "raw": Uint8Array,         // raw samples from heart rate monitor
       */
      if(hrm.confidence >= 50)
      {
        print(hrm); //Debug info of HRM printed to terminal
        //Update the HRM BLE Service
        try
        {
          NRF.updateServices({
            0x180D : {
              0x2A37 : {
                value : [0x06, hrm.bpm],
                notify: true
              }
            }
          });
        }catch(e) { }
      }
    });
  }

  beat()
  {
    this.size = this.originalSize;
    this.draw();
    setTimeout(() => {
      g.clearRect(this.position.x - (this.size / 2), this.position.y - this.size * 0.35,
                  this.position.x + (this.size / 2), this.position.y + this.size * 0.65);
      this.size = this.originalSize * 0.65;
      this.draw();
      setTimeout(() => {
        this.beat();
      }, 800);
    }, 800);
  }
}


let heart = new Heart(screenCenter(), 80);

function draw() {
    g.reset();
    let screenWidth = g.getWidth();
    let screenHeight = g.getHeight();
    let xCenter = screenWidth / 2;
    let yCenter = screenHeight / 2;

    g.setColor(255, 0, 0);
    g.setFont("6x8", 50);
    //g.drawString("Velneo", 140, 160, true /*clear background*/);
    /*g.fillEllipse(heart.position.x - screenWidth * 0.6,
                  heart.position.y - screenHeight * 0.4,
                  heart.position.x + screenWidth * 0.2,
                  heart.position.y + screenHeight * 0.4);*/

    //heart.drawLeftEllipse();
    //heart.drawRightEllipse();
    //heart.drawPoly();


    heart.beat();
     //g.drawString(heart.leftCircle.points);

    //g.fillEllipse(heart.leftCircle.points);
    //g.fillPoly([0, 0, 100, 100, 200, 100]);
  }

g.clear();
draw();
  

setWatch(() => {
  load();
  heart.dismiss();
},BTN2);