import { batchUpdates } from '../../rm-reconciler/update'
import { runWithPriority,scheduler_UserBlockPriority } from '../../rm-reconciler/schedulerWithReconciler'
import { UserBlockInputLanePriority } from '../../rm-reconciler/Lane'

import { attemptToDispatchEvent } from './DomEventListener'

export const isCapture = 1<<2;


var isBatchingEventUpdates = false
export const batchedEventUpdates = function(fn, a?, b?) {
    if(isBatchingEventUpdates){
        fn(a,b)
    }
    isBatchingEventUpdates = true;
    try{
        batchUpdates(()=>{
            fn(a,b);
        })
    }finally{
        isBatchingEventUpdates = false
    }
}


//调度
export function discreteUpdates(fn, a, b, c, d) {
    batchUpdates(()=>{
        fn(a,b,c,d);
    })
}
export const dispatchDiscreteEvent = function(
    domEventName,
    eventSystemFlags,
    container,
    nativeEvent,
){
    //离散数据进入批量更新
    discreteUpdates(
        dispatchEvent,
        domEventName,
        eventSystemFlags,
        container,
        nativeEvent
    )
}
export const dispatchUserBlockingUpdate = function(
    domEventName,
    eventSystemFlags,
    container,
    nativeEvent,
){
    //并发中断更新先不实现
    //这里是同步的
    runWithPriority(
        scheduler_UserBlockPriority,
        dispatchEvent.bind(
            null,
            domEventName,
            eventSystemFlags,
            container,
            nativeEvent,
        ),
    );
}
export const dispatchEvent = function(
    domEventName,
    eventSystemFlags,
    targetContainer,
    nativeEvent,
){
    //可重复执行的queueDiscreteEvent 先不处理，这里和中断有关系
    //执行事件
    const blockedOn = attemptToDispatchEvent(
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent,
    );
}

 
