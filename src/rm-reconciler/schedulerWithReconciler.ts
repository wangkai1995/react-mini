import { 
    shedulerCallBack as  scheduler_shedulerCallBack, 
    cancelShedulerCallback as scheduler_cancelShedulerCallback,
    runWithPriority as scheduler_runWithPriority,
    getCurrentPriority as scheduler_getCurrentPriority,
    shouldYield
} from'../scheduler/scheduler'
import {  
    priorityType,
    NotPrioity,
    ImmediatelyPriority,
    UserBlockPriority,
    NormalPriority,
    LowPrioity,
    IdlePrioity ,
} from'../scheduler/scheduler'
import {
    LanePriorityType,
} from './Lane'
import { Task as schedulerTask } from '../scheduler/task'

export { getCurrentPriority as scheduler_getCurrentPriority} from'../scheduler/scheduler'

export type Task = schedulerTask
//执行同步任务队列
var SynQueue;
var immediateQueueCallbackNode

export type scheduler_priorityType = priorityType
export const sheduler_NotPrioity =  NotPrioity
export const scheduler_ImmediatelyPriority = ImmediatelyPriority
export const scheduler_UserBlockPriority = UserBlockPriority
export const scheduler_NormalPriority = NormalPriority
export const scheduler_LowPrioity = LowPrioity
export const scheduler_IdlePrioity = IdlePrioity

export const scheduler_shouldYield = shouldYield;

export const cancelShedulerCallback = function(task:Task){
    return scheduler_cancelShedulerCallback(task)
}

export const shedulerSynCallBack = function(callback:Function){
    if (!SynQueue) {
        SynQueue = [callback];
        immediateQueueCallbackNode =  scheduler_shedulerCallBack(
            ImmediatelyPriority,
            flushSyncCallbackQueue,
        );
    } else {
        SynQueue.push(callback);
    }
}

export const getCurrentPriorityLevel = function(){
    return scheduler_getCurrentPriority() as scheduler_priorityType
}

export const runWithPriority = function(shedulerPriority:scheduler_priorityType,callback:Function){
    return scheduler_runWithPriority(shedulerPriority,callback)
}

export const shedulerCallBack = function(shedulerPriority:scheduler_priorityType,callback:Function){
    return scheduler_shedulerCallBack(shedulerPriority,callback)
}

//执行任务队列
export const flushSyncCallbackQueue = function(){
    //确保只执行一次
    if (immediateQueueCallbackNode !== null) {
        const node = immediateQueueCallbackNode;
        immediateQueueCallbackNode = null;
        scheduler_cancelShedulerCallback(node);
    }
    const queue = SynQueue;
    if(!SynQueue){ return; }
    scheduler_runWithPriority(ImmediatelyPriority, () => {
        for (var i=0; i < queue.length; i++) {
            let callback = queue[i];
            do {
                callback = callback();
            } while (callback);
        }
        SynQueue = null;
    });
}

