{ pkgs }: {
  deps = [
    pkgs.nodejs-14_x  20.18.0
    pkgs.sqlite
    pkgs.nodePackages.npm
  ];
}
