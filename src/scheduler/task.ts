import { 
    priorityType,
    ImmediatelyPriority,
    UserBlockPriority,
    NormalPriority,
    IdlePrioity
} from './scheduler'


//priority to expirationTimes
export const ImmediatelyTime = -1;
export const UserBlockTime = 250;
export const NotIdleTime = 5000;
export const IdleTime = 50000;
export const priorityToTime = function(priorityLevel:priorityType):number{
    switch(priorityLevel){
        case ImmediatelyPriority: 
            return ImmediatelyTime
        case UserBlockPriority: 
            return UserBlockTime
        case NormalPriority:
            return NotIdleTime
        case IdlePrioity:
        default:
            return IdleTime
    }
}



export type Task = {
    id:number
    callback:Function
    priorityLevel:priorityType
    startTime:number
    expirationTime:number
    sortIndex:number
}



