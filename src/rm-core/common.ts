
import { reactElementType } from '../share/type'

export const createElement = function(tag, props, ...children):reactElementType {
    children = children.length> 1?children:(children.length?children[0]:undefined);
    const elementProps = {
        ...props
    }
    if(children){
        elementProps['children'] = children
    }
    return {
        type: tag,
        ref: props && props.ref?props.ref:null,
        props:elementProps,
    };
};

