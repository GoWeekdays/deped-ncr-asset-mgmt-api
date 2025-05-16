export declare type TKeyValuePair<K extends string | number | symbol = string, V = any> = {
    [key in K]: V;
}