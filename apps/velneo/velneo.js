function screenCenter()
{
  return { x: g.getWidth() / 2, y: g.getHeight() / 2};
}

let heart;

class Heart {
  constructor(position, size){
    this.position = position;
    this.size = size;
    this.originalSize = size;

    //Properties
    this.bpmBaseDelta = 2; // 2 original value
    this.MaxHrmHistoryLength = 10;
    this.HrmHistory = [{ "bpm": 62, "confidence": 100, "correctedBpm": 62 }];

    //History LIMIT for Evaluations
    this.HRM_HISTORY_EVALUATION_LIMIT = 3;

    //Confidence Levels
    this.CONFIDENCE_LEVEL_HIGH = 3; // CONFIDENCE >= 75
    this.CONFIDENCE_LEVEL_MEDIUM = 2; // 25 < CONFIDENCE < 75
    this.CONFIDENCE_LEVEL_LOW = 1; // 0 < CONFIDENCE <= 25
    this.CONFIDENCE_LEVEL_ZERO = 0; // CONFIDENCE == 0


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

    //Set Graphic settings
    g.reset();
    g.setColor(255, 0, 0);
    g.setFont("6x8", 50);

    heart.drawPoly(); // Bottom part of the heart
    heart.drawLeftEllipse(); // Top Left part of the heart
    heart.drawRightEllipse(); //Top Right part of the heart
  }

  setHRMService(){
    NRF.setServices({
      0x180D: { // heart_rate
        0x2A37: { // heart_rate_measurement
        value : [0x06, this.getLastBpm()],
        maxLen : 32,
        notify: true
        }
      }
    }, { advertise: [ '180D' ] });

    //start tracking and notify bpm variations
    this.startTrackingHRM();
  }

  saveHrmData(hrm){
    if(this.HrmHistory.length == this.MaxHrmHistoryLength)
      this.HrmHistory.shift(); // Remove the most non recent value
    // Add the most recent available value
    this.HrmHistory.push(hrm);
  }

  getConfidenceLevel(confidence){
    if(confidence >= 75)
      return this.CONFIDENCE_LEVEL_HIGH;
    if(confidence > 25 && confidence < 75)
      return this.CONFIDENCE_LEVEL_MEDIUM;
    if(confidence > 0 && confidence <= 25)
      return this.CONFIDENCE_LEVEL_LOW;
    if(confidence == 0)
      return this.CONFIDENCE_LEVEL_ZERO;
    
    print("Error: " + confidence);
  }
  
  getLastBpm(){
    return this.HrmHistory.length > 0 ? this.HrmHistory[this.HrmHistory.length - 1].correctedBpm : undefined;
  }

  //Gives back the average of the last n = "limit" number of bpm recorded
  getHrmBpmAvg(limit){
    //If no limit is speficied the return value is the avg of all the values
    if(limit === undefined || limit > this.HrmHistory.length) { limit = this.HrmHistory.length; }

    let i = this.HrmHistory.length - limit;
    let sum = 0;
    while(i < this.HrmHistory.length)
    {
      sum = sum + this.HrmHistory[i].correctedBpm;
      i++; //loop increment
    }

    let avg = limit > 0 ? (sum / limit) : 0;

    return avg;
  }
  
  //Gives back the standard deviation of the last n = "limit" number of bpm recorded
  getHrmBpmStd(limit){
    //If no limit is speficied the return value is the avg of all the values
    if(limit === undefined || limit > this.HrmHistory.length) { limit = this.HrmHistory.length; }

    let avg = getHrmBpmAvg(limit);

    let i = this.HrmHistory.length - limit;
    let sumMSE = 0; //Sum Mean Square Error
    while(i < this.HrmHistory.length)
    {
      sumMSE = sumMSE + Math.pow((this.HrmHistory[i].correctedBpm - avg), 2);
      i++; //loop increment
    }

    let std = limit > 0 ? Math.sqrt(sumMSE / limit) : 100;

    return std;
  }

  //Gives back the average of the last n = "limit" number of bpm confidence recorded
  getHrmConfidenceAvg(limit){
    //If no limit is speficied the return value is the avg of all the values
    if(limit === undefined || limit > this.HrmHistory.length) { limit = this.HrmHistory.length; }

    let i = this.HrmHistory.length - limit;
    let sum = 0;
    while(i < this.HrmHistory.length)
    {
      sum = sum + this.HrmHistory[i].confidence;
      i++; //loop increment
    }

    let avg = limit > 0 ? (sum / limit) : 0;

    return avg;
  }
  
  getSmoothCoeff(){

    //Default value
    let smoothCoeff = 0;

    //Confidence Avg in the recent history
    let confidenceAvg = this.getHrmConfidenceAvg(this.HRM_HISTORY_EVALUATION_LIMIT);
    let confidenceAvgLevel = this.getConfidenceLevel(confidenceAvg);

    //The more was accurate in the recent history the less the "jump" to the next bpm value will be smoothed
    switch(confidenceAvgLevel)
    {
        case this.CONFIDENCE_LEVEL_HIGH:
          smoothCoeff = 0;
          break;
        case this.CONFIDENCE_LEVEL_MEDIUM:
          smoothCoeff = 0.7;
          break;
        case this.CONFIDENCE_LEVEL_LOW:
        case this.CONFIDENCE_LEVEL_ZERO:
          smoothCoeff = 0.1;
          break;
    }

    return smoothCoeff;
  }

  getConfidenceIdByLevel(level)
  {
    if(level == 3) { return "CONFIDENCE_LEVEL_HIGH"; }
    if(level == 2) { return "CONFIDENCE_LEVEL_MEDIUM"; }
    if(level == 1) { return "CONFIDENCE_LEVEL_LOW"; }
    if(level == 0) { return "CONFIDENCE_LEVEL_ZERO"; }
  }
  
  hasHRMSignal()
  {
    let isWorkingThreshold = 5;
    if(this.getHrmBpmAvg(isWorkingThreshold) < 10)
    {
      return false;
    }

    return true;
  }

  printHrmBpmHistory(){
    let array = [];
    let h = 0;
    while(h < this.HrmHistory.length -1)
    {
      array.push(this.HrmHistory[h].correctedBpm);
      h++;
    }
    
    print(array);
  }
  
  startTrackingHRM(){
    Bangle.setHRMPower(1);
    Bangle.on('HRM',function(hrm) {
      /*hrm is an object containing:
        { "bpm": number,             // Beats per minute
          "confidence": number,      // 0-100 percentage confidence in the heart rate
          "raw": Uint8Array,         // raw samples from heart rate monitor
       */

      //Distance 
      let bpmDelta = (hrm.bpm - heart.getLastBpm());
      bpmDelta = hrm.bpm == 200 ? 0 : bpmDelta; //This value (200 bpm) seems to be wrong, 

      let correctedbpm;

      let confidenceLevel = heart.getConfidenceLevel(hrm.confidence);
      print("\n" + heart.getConfidenceIdByLevel(confidenceLevel));
      print("BPM: " + hrm.bpm + ", Confidence: " + hrm.confidence);
      switch(confidenceLevel)
      {
        case heart.CONFIDENCE_LEVEL_HIGH:
        case heart.CONFIDENCE_LEVEL_MEDIUM:

          //The more was accurate in the recent history the less the "jump" to the next bpm value will be smoothed
          let smoothCoeff = heart.getSmoothCoeff();
          
          correctedbpm = heart.getLastBpm() + bpmDelta * (hrm.confidence / 100.0) * (1 - smoothCoeff);
          heart.bpmBasePenalty = 3; // Reset to original base penalty value
          break;

        case heart.CONFIDENCE_LEVEL_LOW:
        case heart.CONFIDENCE_LEVEL_ZERO:

          let hasHRMSignal = heart.hasHRMSignal();

          //This is when the confidence is 0 for a significant amount of time
          // And we guess that the watch is not on the wrist anymore
          if(!hasHRMSignal)
          {
            correctedbpm = 0;
          }
          else
          {
            correctedbpm = bpmDelta > 0 ? heart.getLastBpm() + heart.bpmBaseDelta : heart.getLastBpm() - heart.bpmBaseDelta;
          }

          break;
      }
      
      //save in hrm structure the final corrected bpm value
      hrm.correctedBpm = correctedbpm < 0 ? 0 : Math.round(correctedbpm);

      //Save hrm value
      heart.saveHrmData(hrm);

      heart.printHrmBpmHistory();
      //print(heart.HrmHistory[heart.HrmHistory.length -1]);

      //print("bpm: " + hrm.bpm + ", confidence : " + hrm.confidence + "\n");
      //Update the HRM BLE Service
      try
      {
        NRF.updateServices({
          0x180D : {
            0x2A37 : {
              value : [0x06, hrm.correctedBpm],
              notify: true
            }
          }
        });
      }catch(e) { }
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

heart = new Heart(screenCenter(), 80);

g.clear();
heart.beat();

setWatch(() => {
  load();
  heart.dismiss();
},BTN1);