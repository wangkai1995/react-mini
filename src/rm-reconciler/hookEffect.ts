import { 
    Fiber,fiberEffect,
    HookPassiveEffect,HookLayoutEffect
} from './Fiber'
import {
    idleLanePriority, lanePriorityToShedulerPriority,
} from './Lane'
import { 
    getRootDoesHavePassiveEffects,setRootDoesHavePassiveEffects,
    getRootWithPendingPassiveEffects,setRootWithPendingPassiveEffects,
    getPendingPassiveEffectsRenderPriority,setPendingPassiveEffectsRenderPriority,
} from './workCommit'
import { shedulerCallBack,runWithPriority,getCurrentPriorityLevel,sheduler_NotPrioity,scheduler_NormalPriority } from './schedulerWithReconciler'
import { Hook } from './hook'

var pendingPassiveHookEffectsMount = []
var pendingPassiveHookEffectsUnmount = []


export const flushPassiveEffects = function(){
    const pendingPassiveEffectsRenderPriority = getPendingPassiveEffectsRenderPriority()
    //commit阶段下，不能执行flushPassiveEffects
    if(pendingPassiveEffectsRenderPriority !== sheduler_NotPrioity){
        const priorityLevel =
        pendingPassiveEffectsRenderPriority > scheduler_NormalPriority
            ? scheduler_NormalPriority
            : pendingPassiveEffectsRenderPriority;
        setPendingPassiveEffectsRenderPriority(sheduler_NotPrioity)
        return runWithPriority(priorityLevel,()=>{
            //flushPassiveEffectsImp 简化实现
            if(!getRootWithPendingPassiveEffects()){
                return
            }
            setRootWithPendingPassiveEffects(null)
            //简单执行
            //执行unmount
            var passiveHookUnmount = pendingPassiveHookEffectsUnmount
            pendingPassiveHookEffectsUnmount = []
            for(var i=0;i<passiveHookUnmount.length;i+=2){
                var effect = passiveHookUnmount[i]
                var fiber = passiveHookUnmount[i+1];
                var destory = effect.destory
                if(typeof destory === 'function'){
                    destory();
                }
            }
            //执行mount
            var passiveHookMount = pendingPassiveHookEffectsMount
            pendingPassiveHookEffectsMount = []
            for(var i=0;i<passiveHookUnmount.length;i+=2){
                var effect = passiveHookMount[i]
                var fiber = passiveHookMount[i+1];
                var create = effect.create
                if(typeof create === 'function'){
                    effect.destory = create();
                }
            }
        })
    }
    return false;
}
export const schedulePassiveEffects = function(finishedWork:Fiber){
    const updateQueue = finishedWork.updateQueue as any
    if(updateQueue){
        const lastEffect = updateQueue.lastEffect
        if(!lastEffect) return ;
        var firstEffect = lastEffect.next
        var effect = firstEffect
        do{
            const { tag } = effect
           if((tag & HookPassiveEffect ) === HookPassiveEffect ){
                enqueuePendingPassiveHookEffectUnmount(finishedWork, effect);
                enqueuePendingPassiveHookEffectMount(finishedWork, effect);
           }
           effect = effect.next;
        }while(effect && effect!==firstEffect)
    }
}
export const enqueuePendingPassiveHookEffectMount = function(fiber:Fiber,effect){
    pendingPassiveHookEffectsMount.push(effect, fiber);
    if(!getRootDoesHavePassiveEffects()){
        setRootDoesHavePassiveEffects(true);
        const shedulerPriority = lanePriorityToShedulerPriority(idleLanePriority)
        shedulerCallBack(shedulerPriority,()=>{
            flushPassiveEffects()
        })
    }
}
export const enqueuePendingPassiveHookEffectUnmount = function(fiber:Fiber,effect){
    pendingPassiveHookEffectsUnmount.push(effect, fiber);
    if(!getRootDoesHavePassiveEffects()){
        setRootDoesHavePassiveEffects(true);
         const shedulerPriority = lanePriorityToShedulerPriority(idleLanePriority)
        shedulerCallBack(shedulerPriority,()=>{
            flushPassiveEffects()
        })
    }
}




export const pushEffect = function(fiber:Fiber,tag:fiberEffect, create,destory,dep){
    const effect = {
        tag,
        destory,
        create,
        dep,
        next:null,
    }
    var updateQueue = fiber.updateQueue as any
    if(!updateQueue){
        fiber.updateQueue = { lastEffect:null } as any
        effect.next = effect;
        (fiber.updateQueue as any).lastEffect =  effect;
    }else{
        var { lastEffect } = fiber.updateQueue  as any
        if(!lastEffect){
            effect.next = effect;
            (fiber.updateQueue as any).lastEffect = effect;
        }else{
            var firstEffect = lastEffect.next
            effect.next = firstEffect
            lastEffect.next = effect;
            (fiber.updateQueue as any).lastEffect = effect;
        }
    }
    return effect;
}


export const mountEffectImp = function(fiber:Fiber,hook:Hook,tag:fiberEffect,create,dep){
    fiber.flag |= tag;
    hook.memoizedState = pushEffect(fiber,tag,create,null,dep)
}


export const updateEffectImp = function(fiber:Fiber,hook:Hook,tag:fiberEffect,create,dep){ 
    const preEffect = hook.memoizedState
    let destory
    if(dep){
        const preDep = preEffect.dep
        destory = preEffect.destory
        if(isEqualDep(preDep,dep)){ 
            pushEffect(fiber,tag,destory,create,dep)
            return 
        }
    }
    fiber.flag |= tag;
    hook.memoizedState = pushEffect(fiber,tag,create,destory,dep)
}


const isEqualDep = function(pre,cur){
    var preDep = Array.isArray(pre)?pre:[pre]
    var currentDep = Array.isArray(cur)?cur:[cur]
    if(preDep.length !== currentDep.length){
        return false;
    }
    if(preDep.some((e,i)=>e !== currentDep[i])){
        return false;
    }
    return true
}


