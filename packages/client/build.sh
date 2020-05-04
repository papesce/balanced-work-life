#!/bin/bash

rm -rf  ../server/public;
mkdir ../server/public;
cp -a ../server/api-docs/. ../server/public/api-docs;
cp -a ../server/assets/. ../server/public/assets;
cd build
mv * ../../server/public