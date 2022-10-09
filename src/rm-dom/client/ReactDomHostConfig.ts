import { 
    FiberRoot,Fiber,
    NotEffect,PlaceEffect,incompleteEffect,UpdateEffect,DeleteEffect,SnapshotEffect, RefEffect,
    HostRoot,ClassComponent,FunctionComponent,HostComponent,HostText,LazyComponent,
} from '../../rm-reconciler/Fiber'

export const reactFiberSymbol = '_reactFiber'
export const reactPropsSymbol = '_reactProps'


export const shouldSetTextContent = function(type: string, props: any): boolean {
    return (
      type === 'textarea' ||
      type === 'option' ||
      type === 'noscript' ||
      typeof props.children === 'string' ||
      typeof props.children === 'number' ||
      (typeof props.dangerouslySetInnerHTML === 'object' &&
        props.dangerouslySetInnerHTML !== null &&
        props.dangerouslySetInnerHTML.__html != null)
    );
}



export const updateHostContainer = function(workProcess:Fiber){
    //noop
}
export const updateHostComponent = function(current:Fiber,workProcess:Fiber,type:string,newProps:any){
    const oldProps = current.memoizedProps;
    //如果不存在更新
    if (oldProps === newProps) {
      return;
    }
    //对比更新
    const instance: HTMLElement = workProcess.stateNode as HTMLElement;
    const updatePayload = diffProperties(instance,workProcess.type as String,oldProps,newProps)
    workProcess.updateQueue = updatePayload
    if(updatePayload){
        workProcess.flag |= UpdateEffect
    }
    // 目前事件系统下有个bug 要及时更新挂载的instance不然会导致 hook事件的读取值存在引用缓存问题
    // instance[reactFiberSymbol] = workProcess 这也是一个简单的解决办法，但是这个方法会受到中断的影响,最终的结果workProcess !== current
    // 这部分用updateFiberProps 代替
    // 在合成时间里面的getListener 会调用getFiberCurrentPropsFromNode 获取最新的props
}
export const updateHostText = function( current:Fiber,workInProgress: Fiber,oldText: string,newText: string){
    //检测是否有更新
    if(oldText !== newText){
        workInProgress.flag |= UpdateEffect;
    }
}
export const updateRef = function(current:Fiber|null,workProcess:Fiber){
    const ref = workProcess.ref;
    if (
      (current === null && ref !== null) ||
      (current !== null && current.ref !== ref)
    ) {
        workProcess.flag |= RefEffect
    }
}
export const updateFiberProps = function(domElement: HTMLElement,nextProps:object){
    domElement[reactPropsSymbol] = nextProps
}


export const diffProperties = function( domElement: HTMLElement,type: String,oldProps: object,newProps: object):any{
    //react 源码中存在几个特殊标签需要特殊处理  input select options textarea
    //作为 attribute 和 property 的 value  相关的处理问题
    //后面涉及到这个问题。在处理，主要是 attribute 设置的value 和ref直接使用ref.value 的不同步问题
    switch(type){
        case 'input':
        case 'select':
        case 'options':
        case 'textarea':
            console.error('diffProperties: input,select,options,textarea 特殊标签属性需要处理 作为 attribute 和 property 的 value  相关的处理问题')
    }
    let propKey
    let styleName
    let styleProps = null;
    let updatePayload = null
    //删除
    for(propKey in oldProps){
        //新增的跳过
        if(newProps.hasOwnProperty(propKey) || !oldProps.hasOwnProperty(propKey)){
            continue;
        }
        //计算删除的样式
        if( propKey === 'style'){
            for( styleName in oldProps[propKey]){
                if(oldProps[propKey].hasOwnProperty(styleName)){
                    styleProps = styleProps || {};
                    styleProps[styleName] = '';
                }
            }
        }
        //其他的一些属性暂不处理，innerHTML等。
        //减去删除的
        updatePayload = updatePayload || [];
        updatePayload.push(propKey,null);
    }
    //修改和新增
    for(propKey in newProps){
        if(propKey === 'style'){
            for( styleName in newProps[propKey]){
                if(styleProps.hasOwnProperty(styleName)){
                    continue
                }
                styleProps = styleProps || {};
                styleProps[styleName] = newProps[propKey][styleName];
            }
            if(styleProps){
                updatePayload = updatePayload || [];
                updatePayload.push(propKey,styleProps);
            }
            continue;
        }
        if(propKey === 'children'){
            if( typeof newProps[propKey] === 'string' || typeof newProps[propKey] === 'number' ){
                updatePayload = updatePayload || [];
                updatePayload.push(propKey,newProps[propKey]);
            }
            continue;
        }
        if(/^on([a-zA-Z]+)$/.test(propKey)){
            //存在事件的时候需要更新一下防止缓存死区
            updatePayload = updatePayload || [];
            continue;
        }
        if(newProps[propKey]==oldProps[propKey]){
            continue;
        }
        updatePayload = updatePayload || [];
        updatePayload.push(propKey,newProps[propKey]);
    }
    return updatePayload
}
export const setInitialDOMProperties = function(domElement: Element,nextProps: Object){
    //这里简化处理了，暂不处理特殊 属性 innerHtml autofocus scroll 等等
    for (let propKey in nextProps) {
        if (propKey === "children") {
           continue;
        }
        if (/^on([a-zA-Z]+)$/.test(propKey)) {
           continue;
        }
        domElement.setAttribute(propKey,nextProps[propKey])
    }
};
export const updateDOMProperties = function(domElement:Element,propKey:string,propsValue:any){
    //这里简化处理了
    if (propKey === "children") {
        return;
    }
    if (/^on([a-zA-Z]+)$/.test(propKey)) {
        return;
    }
    //这里还缺少逻辑,设置的PropKey,必须是dom支持的,其他的不应该设置到dom上
    domElement.setAttribute(propKey,propsValue)
}
export function hideInstance(instance: HTMLElement): void {
    const style = instance.style;
    if (typeof style.setProperty === 'function') {
      style.setProperty('display', 'none', 'important');
    } else {
      style.display = 'none';
    }
}
export function hideTextInstance(textInstance: Text): void {
    textInstance.nodeValue = '';
}
export function unhideInstance(instance: HTMLElement, props: any): void {
    const styleProp = props['style'];
    const display =
      styleProp !== undefined &&
      styleProp !== null &&
      styleProp.hasOwnProperty('display')
        ? styleProp.display
        : null;
    const style = instance.style;
    if (typeof style.setProperty === 'function') {
        style.setProperty('display', display, 'important');
    } else {
        style.display = display;
    }
} 
export function unhideTextInstance(textInstance: Text,text: string,): void {
    textInstance.nodeValue = text;
}

export const appendInsertBeforeChild = function(parent:HTMLElement,current: Fiber,before:Fiber){
    return parent.insertBefore(current.stateNode as HTMLElement,before.stateNode as HTMLElement)
}
export const appendChild = function(parent:HTMLElement,current: Fiber){
    return parent.appendChild(current.stateNode as HTMLElement)
}
export const appendAllChildren = function(parent:HTMLElement,workProcess: Fiber){
    let node = workProcess.children;
    while (node) {
        if (node.tag === HostComponent || node.tag === HostText) {
            appendChild(parent,node)
        } else if (node.children) {
            node.children.return = node;
            node = node.children;
            continue;
        }
        if (node === workProcess) {
            return;
        }
        while (!node.sibling) {
            if (!node.return  || node.return === workProcess) {
                return;
            }
            node = node.return as Fiber;
        }
        node.sibling.return = node.return;
        node = node.sibling;
    }
}
export const createInstance = function(type:string,newProps:any,workProcess:Fiber):HTMLElement{
    const dom = document.createElement(type)
    dom[reactFiberSymbol] = workProcess
    updateFiberProps(dom,newProps)
    return dom
}
export const createTextInstance = function(newText:string,workProcess:Fiber):Text{
    const text = document.createTextNode(newText)
    text[reactFiberSymbol] = workProcess
    return text
}
export const removeChild = function(parent:HTMLElement,current: Fiber){
    return parent.removeChild(current.stateNode as HTMLElement)
}

