type ProgramCellElement = HTMLButtonElement & {
    posLeft: number | null;
    posWidth: number | null;
    guideProgramName: string | null;
};

const ProgramCellPrototype = Object.create(HTMLButtonElement.prototype) as ProgramCellElement & {
    detachedCallback?: (this: ProgramCellElement) => void;
};

ProgramCellPrototype.detachedCallback = function (this: ProgramCellElement): void {
    this.posLeft = null;
    this.posWidth = null;
    this.guideProgramName = null;
};

document.registerElement('emby-programcell', {
    prototype: ProgramCellPrototype,
    extends: 'button'
});
