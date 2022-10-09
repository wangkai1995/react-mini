import { Task } from './task'
var taskQueue:Task[] = []


var signDownSort = function(queue:any[],sort:(a,b)=>boolean){
    for(var i=Math.floor(queue.length/2);i>=0;i--){
        var current = queue[i]
        var left = queue[i*2+1];
        var right = queue[i*2+2];
        if(left && sort(left,current)){
            queue[i] = left
            queue[i*2+1] = current
            current = left
        }
        if(right && sort(right,current)){
            queue[i] = right
            queue[i*2+2] = current
        }
    }
}

const peek = function(taskQueue:Task[]):Task{
    return taskQueue[0];
}
const push = function(taskQueue:Task[],task:Task):void{
    taskQueue.push(task)
    signDownSort(taskQueue,(a:Task,b:Task)=>{
        return a.sortIndex <= b.sortIndex
    })
} 
const pop = function(taskQueue:Task[]):Task{
    var task = taskQueue.shift();
    signDownSort(taskQueue,(a:Task,b:Task)=>{
        return a.sortIndex <= b.sortIndex
    })
    return task
}



export const taskQueuePeek = function():Task{
    return peek(taskQueue);
}
export const taskQueuePop = function():Task{
    return pop(taskQueue);;
}
export const taskQueuePush = function(task:Task):void{
    return push(taskQueue,task);
}


