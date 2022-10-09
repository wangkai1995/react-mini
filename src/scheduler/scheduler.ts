import { taskQueuePush,taskQueuePeek,taskQueuePop } from './minHeap';
import { Task,priorityToTime } from './task'
import { requestHostCallback,cancelHostCallback,shouldYieldToHost,getCurrentTime } from './hostCallback'

export type priorityType = 0|1|2|3|4|5
export const NotPrioity = 0;
export const ImmediatelyPriority = 1;
export const UserBlockPriority  = 2;
export const NormalPriority  = 3;
export const LowPrioity = 4
export const IdlePrioity = 5;
var priorityLevel = NormalPriority
export const getCurrentPriority = function():priorityType{
    return priorityLevel as priorityType
}
var isHostCallbackScheduled:boolean = false;
var isPerformingWork:boolean = false;
var currentTask:Task
var taskIdCounter = 0;

export const shouldYield = shouldYieldToHost
//立即执行
export const runWithPriority = function(priority:priorityType,callback){   
    var previousPriorityLevel = priorityLevel;
    priorityLevel = priority;
    try {
        return callback();
    } finally {
        priorityLevel = previousPriorityLevel;
    }
}
//传入优先级 执行调度任务
export const shedulerCallBack= function(priority:priorityType,callback){
    var startTime = getCurrentTime();
    var timeout = priorityToTime(priority)
    var expirationTime = startTime+timeout
    //延时执行的timeQueue先不实现
    //只处理taskQueue
    const task:Task = {
        id: taskIdCounter++,
        callback : callback,
        priorityLevel : priority,
        startTime : startTime,
        expirationTime : expirationTime,
        sortIndex: -1,
    }
    task.sortIndex = expirationTime;
    taskQueuePush(task)
    if(!isHostCallbackScheduled && !isPerformingWork){
        //开始执行
        isHostCallbackScheduled = true;
        requestHostCallback(flushWork)
    }
    return task;
}
//取消调度任务
export const cancelShedulerCallback = function(callback:Task){
    callback.callback = null;
}



const flushWork = function(initialTime){
    isHostCallbackScheduled = false;
    isPerformingWork = true
    try{
        try {
            return workLoop(initialTime);
        } catch (error) {
            throw error;
        }
    }finally{
        isPerformingWork = false;
    }
}
const workLoop = function(initialTime){
    let currentTime = initialTime;
    currentTask = taskQueuePeek();
    while(currentTask){
        if( currentTask.expirationTime > currentTime && shouldYieldToHost()){
            break;
        }
        const callback = currentTask.callback;
        if(typeof callback === 'function'){
            //执行
            const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
            const continuationCallback = callback(didUserCallbackTimeout);
            //更新一下当前时间
            currentTime = getCurrentTime();
            //是否完成
            if (typeof continuationCallback === 'function') {
                currentTask.callback = continuationCallback;
            }else{
                if (currentTask === taskQueuePeek()) {
                    taskQueuePop();
                }
            }
        }else{
            taskQueuePop()
        }
        currentTask = taskQueuePeek();
    }
    if (currentTask){
        return true;
    } else {
        return false;
    }
}

